import { 
    PutCommandInput,
    UpdateCommandInput,
    BatchWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

import _assign from "lodash/assign";
import _chunk from "lodash/chunk";
import { DDBCommom } from "./DDB";

import AEntity, {IEntity} from "./AEntity";

export {IEntity}

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
         let current = -1;
         
         this._data._SK = this.SK_PATTERN
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
        if(!this._data._SK) return 0;

        return parseInt( this._data._SK.split("#")[2] as string, 10);
    }

    /**
     * Add +1 to version number
     */
    private _versionAdd()
    {
        const beginsWith = this._SkWithoutVersion(this._data._SK as string, true);
        const current    = this.getVersion();

        this._data._SK = `${beginsWith}#${current+1}`;
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
         await this.createPreHook();
 
         const params = {
             TableName: this.TABLE_NAME,
             Item: this._data as any,
             ConditionExpression: 'attribute_not_exists(#PK) AND attribute_not_exists(#SK)',
             ExpressionAttributeNames: { "#PK": "_PK", "#SK": "_SK" },
             ReturnConsumedCapacity: "TOTAL"
         } as PutCommandInput
 
         if(ddbTrx) return params;

         return await DDBCommom.Put(params);
     }

     async createPreHook()
     {
         // Update last documents to [ENTITY NAME]_V
         const lstItens = await this.getAllVersions();

         console.log(lstItens);

         for(let i=0; i<lstItens.length; i++)
         {
             const item = lstItens[i];

             const params = {
                TableName: this.TABLE_NAME,
                Key: {
                    "_PK": item._PK as any,
                    "_SK": item._SK as any
                },
                UpdateExpression: "set #field = :val",
                ExpressionAttributeNames: {"#field": "_ENTITY"},
                ExpressionAttributeValues: {":val": this.ENTITY+"_V"},
                ReturnValues: "ALL_NEW"
            } as UpdateCommandInput;

            await DDBCommom.Update(params);
         };
     }

     /**
      * @override
      * Returns, always, the last documento version, query is about SK => [type]#[sort]#[MAX_VERSION]
      */ 
    async get(pk: string, sk: string, consistentRead = false) 
    {
        const beginsWith = this._SkWithoutVersion(sk); // remove version part from SK

        const condition  = `#PK = :pk and begins_with(#SK, :sk)`;

        const first = await DDBCommom.Query_First({
            TableName: this.TABLE_NAME,
            ScanIndexForward: false, // last first

            KeyConditionExpression: condition,

            ExpressionAttributeNames: { "#PK": "_PK", "#SK": "_SK" },

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
        const lstItens = await this.getAllVersions();

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
                                "_PK": item._PK as any,
                                "_SK": item._SK as any
                            }
                        }
                    }
                );
            });

            await DDBCommom.BatchWrite(params);
        }

        return true;
    }

    private async getAllVersions()
    {
        const sk = this._SkWithoutVersion(this._data._SK as string);
        const lstItens = await DDBCommom.Query<IEntity>({
            TableName: this.TABLE_NAME,
            ProjectionExpression: "#PK, #SK",
            KeyConditionExpression: "#PK = :pk and begins_with(#SK, :sk)",
            ExpressionAttributeNames: { "#PK": "_PK", "#SK": "_SK" },
            ExpressionAttributeValues: {
                ":pk": this._data._PK as any,
                ":sk": sk as any
            }
        }, 0);
        return lstItens;
    }

    /**
     * @override
     */
    async deleteCurrentVersion()
    {
        await DDBCommom.Delete({
            TableName: this.TABLE_NAME,
            Key: {
                "_PK": this._data._PK as any,
                "_SK": this._data._SK as any
            },
        });

        return true;
    }
    
    //#endregion
}