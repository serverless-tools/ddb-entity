import { 
    PutCommandInput,
    UpdateCommandInput,
    BatchWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

import _assign from "lodash/assign";
import _chunk from "lodash/chunk";
import { DDBCommom } from "./DDB";

import AEntity, {IEntity} from "./AEntity";

export default abstract class AEntityVersion<T extends IEntity> extends AEntity<T>
{
    //#region [Overrides]

    constructor(type: string, json?: any)
    {
        super(type, json, "[type]#[sort]#[ver]"); // Setup a new SK pattern for this entity type
    }

    /**
     * @override
     * Set SK with version.
     * If SK exists, add a version.
     * 
     * Should be overwrite by the final model wheter use a custom SK pattern.
     */ 
     setSK(sort: string, reset = false) 
     { 
         let current = reset ? 0 : this.getVersion();
         
         this._data.SK = this.SK_PATTERN
             .replace("[type]", this.ENTITY as string)
             .replace("[sort]", sort)
             .replace("[ver]", (current).toString());
 
         return this;
     }
 
    //#endregion

    //#region [Version methods]

    /**
     * @return get version of current SK
     */
    public getVersion() : number
    {
        if(!this._data.SK) return 0;

        return parseInt( this._data.SK.split("#")[2] as string, 10);
    }

    /**
     * Add +1 to version number
     */
    private _versionAdd()
    {
        const beginsWith = this._SkWithoutVersion(this._data.SK as string, true);
        const current    = this.getVersion();

        this._data.SK = `${beginsWith}#${current+1}`;
        return this;
    }

    private _SkWithoutVersion(sk: string, cropLastHash = false)
    {
        return sk.slice(0, sk.lastIndexOf("#")) + (cropLastHash ? "" : "#");
    }

    //#endregion

    //#region [Operations]

    async put(ddbTrx: boolean = false)
    {
        return this.create(ddbTrx);
    }

    /**
     * @override
     * Save new item (or new version, never change de self data).
     * 
     * If the PK and SK exists throw error;
     * 
     * @param ddbTrx inherit
     */ 
     async create(ddbTrx: boolean = false)
     {
         this.validate();
         this.setDtCreatedNow();
         this._versionAdd();
 
         const params = {
             TableName: this.TABLE_NAME,
             Item: this._data as any,
             ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
             ReturnConsumedCapacity: "TOTAL"
         } as PutCommandInput
 
         if(ddbTrx) return params;

         return await DDBCommom.Put(params);
     }

     /**
      * @override
      * Returns, always, the last documento version, query is about SK => [type]#[sort]#[MAX_VERSION]
      */ 
    async get(pk: string, sk: string, consistentRead = false) 
    {
        const beginsWith = this._SkWithoutVersion(sk);
        const condition  = `${AEntityVersion.NameOf("PK")} = :pk and begins_with(${AEntityVersion.NameOf("SK")}, :sk)`;

        const first = await DDBCommom.Query_First({
            TableName: this.TABLE_NAME,
            ScanIndexForward: false, // last first

            KeyConditionExpression: condition,

            ExpressionAttributeValues: {  
                ":pk": pk,
                ":sk": beginsWith
            } as any
        });

        return first || null;
    }

    /**
     * @override
     */
     async update(ddbTrx: boolean = false) : Promise<boolean|UpdateCommandInput>
     {
         throw "Versioning entity does't allow update";
         return false;
     } 

    /**
     * @override
     * Delete all versions
     */
    async delete()
    {
        // get all itens
        const sk = this._SkWithoutVersion(this._data.SK as string);
        const lstItens = await DDBCommom.Query<IEntity>({
            TableName: this.TABLE_NAME,
            ProjectionExpression: "PK, SK",
            KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": this._data.PK as any,
                ":sk": sk as any
            }
        }, 0);

        // split in chuncks of 25 (max batch write dynamodb limit)
        const chunks = _chunk(lstItens, 25);

        for(let i=0; i<chunks.length; i++) // prepare and execute the batchWrite()
        {
            const chunkItem = chunks[i];
            const params    = {} as BatchWriteCommandInput;

            params.RequestItems = {};
            params.RequestItems[this.TABLE_NAME] = [];

            chunkItem.forEach((item) => 
            {
                if(params && params.RequestItems && params.RequestItems[this.TABLE_NAME])
                params.RequestItems[this.TABLE_NAME].push(
                    {
                        DeleteRequest: {
                            Key: {
                                PK: item.PK as any,
                                SK: item.SK as any
                            }
                        }
                    }
                );
            });

            await DDBCommom.BatchWrite(params);
        }

        return true;
    }

    /**
     * @override
     */
    async deleteCurrentVersion()
    {
        await DDBCommom.Delete({
            TableName: this.TABLE_NAME,
            Key: {
                PK: this._data.PK as any,
                SK: this._data.SK as any
            },
        });

        return true;
    }
    
    //#endregion
}