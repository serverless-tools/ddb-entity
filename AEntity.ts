import _assignIn from "lodash/assignIn";
import _cloneDeep from "lodash/cloneDeep";
import _set from "lodash/set";
import _unset from "lodash/unset";
import _has from "lodash/has";
import _get from "lodash/get";
import _forOwn from "lodash/forOwn";
import _chunk from "lodash/chunk";

import { 
    BatchWriteCommandInput,
    PutCommandInput,
    PutCommandOutput,
    TransactWriteCommandOutput,
    UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

import { DDBCommom } from "./DDB";

export interface IEntity    // Base entity
{
    _PK?: string 
    _SK?: string 
    _ENTITY?: string  // ex: ORDER, ORDER ITEM, WAIVER, BALANCE, TRANSACTION, PEOPLE, PAGE, etc.

    _CREATED?: string  // new Date().toISOString() => '2020-12-14T01:07:22.016Z' 
    _MODIFIED?: string // new Date().toISOString() => '2020-12-14T01:07:22.016Z' 
}

export default abstract class AEntity<T extends IEntity>
{
    /** @var TABLE_NAME DynamoDB Table name */
    abstract readonly TABLE_NAME: string;

    /** @var PK_DEFAULT DynamoDB Default PK value for insert the entity */
    abstract readonly PK_DEFAULT: string;

    /** @var SK_PATTERN DynamoDB SK value for insert, default is [Entity Name]#[Sort value]  */
    public readonly SK_PATTERN: string; // defaults = "[type]#[sort]";
    
    /** @var _data Where the document stored in DynamoDB Row resides */
    public _data  : T;

    /** @var ENTITY The entity string name */
    public ENTITY : string;

    /** @var linked Boolean indicates whether the _data cames from database (or was inserted successfully) */
    public linked: boolean = false;

    //#region [Main]

    /**
     * @param type Entity name
     * @param json Javascript object to populate the model data (from dynamodb register)
     * @param skPattern Sort Key patten, defaults is "[type]#[sort]", where will be replaced through this.setSK(str)
     */
    constructor(type: string, json?: T, skPattern: string = "[type]#[sort]")
    {
        this.SK_PATTERN = skPattern;
        this.ENTITY     = type;
        this._data      = this._jsonParse(json);
    }

    static NameOf<T>(name: keyof T) : string
    {
        return name as string;
    }

    //#endregion

    //#region [Factories]

    /**
     * Generate data object. 
     * If json param exists, data is initialized with their data.
     */ 
    protected _jsonParse(json?: T)
    {
        let data = {} as T;

        if(json) 
        {
            data = _assignIn({}, json);
            this.linked = true;
        }
        data._ENTITY = this.ENTITY;

        return data;
    }

    /**
     * Generate a SK key string
     */ 
    protected _SKcreate(sk: string, entity: string) : string // should be overwrite if yout skPattern is difrent that defaults ([type]#[sort])
    {
        return this.SK_PATTERN
            .replace("[type]", entity as string)
            .replace("[sort]", sk);
    }

    //#endregion

    //#region [Required Attributes]

    setPK(key: string)  
    { 
        this._data._PK = key; 
        return this;  
    }
    
    setSK(sort: string) 
    { 
        this._data._SK = this._SKcreate(sort, this.ENTITY);
        return this;
    }

    protected setDtModifiedNow()
    {
        this._data._MODIFIED = new Date().toISOString();
        return this;
    }

    protected setDtCreatedNow()
    {
        this._data._CREATED = new Date().toISOString();
        return this;
    }

    setValue(field: keyof T, value: any)
    {
        _set(this._data, field, value);
        return this;
    }

    getValue(field: keyof T)
    {
        if(_has(this._data, field))
            return _get(this._data, field);

        return null;
    }

    //#endregion

    //#region [Validations / Sanitizes]

    validate()
    {
        if(!stringIsNotEmpty(this._data._PK)) throw "PK Required";
        if(!stringIsNotEmpty(this._data._SK)) throw "SK Required";
    }

    //#endregion

    //#region [Operations]

    async get(pk: string, sk: string, consistentRead = false)
    {
        const ret = await DDBCommom.Get({
            TableName: this.TABLE_NAME,
            ConsistentRead: consistentRead,
            Key: {
                "_PK": pk as any,
                "_SK": sk as any
            }
        });

        return ret || null;
    }

    async query<T>(pk: string, skBeginsWith: string, consistentRead = false, scanIndexForward = true) 
    {
        const ret = await DDBCommom.Query({
            TableName: this.TABLE_NAME,
            ScanIndexForward: scanIndexForward,
            ConsistentRead: consistentRead,
            
            KeyConditionExpression: "#PK = :pk and begins_with(#SK, :sk)",
            ExpressionAttributeNames: { "#PK": "_PK", "#SK": "_SK" },
            ExpressionAttributeValues: 
            {
                ":pk": pk as any,
                ":sk": skBeginsWith as any
            },

            // ReturnConsumedCapacity: "TOTAL",
            // ReturnItemCollectionMetrics: "SIZE"
        });

        return (ret || []) as T[];
    }

    /**
     * Save new item or substitute (if checkPkSk is false).
     * 
     * @param checkExists Check if PK and SK exists before put document. If exists, throw a dynamodb error.
     * @param ddbTrx If true returns a DynamoDB PutItemInput and don't execute the insert.
     */ 
    async create(checkExists: boolean = true, ddbTrx: boolean = false) : Promise<PutCommandInput|boolean>
    {
        this.validate();
        this.setDtCreatedNow();

        const params = {
            TableName: this.TABLE_NAME,
            Item: this._data as any,
            ReturnConsumedCapacity: "TOTAL"
        } as PutCommandInput;

        if(checkExists)
        {
            params.ConditionExpression = 'attribute_not_exists(#PK) AND attribute_not_exists(#SK)';
            params.ExpressionAttributeNames = { "#PK": "_PK", "#SK": "_SK" };
        }

        if(ddbTrx) return params;

        await DDBCommom.Put(params);
        this.linked = true;

        return true;
    }

    async update(ddbTrx: boolean = false) : Promise<boolean|UpdateCommandInput>
    {
        this.validate();
        this.setDtModifiedNow();

        let updExpression = "set ";
        let updNames  = {} as any;
        let updValues = {} as any;
        
        _forOwn(this._data, (value, field) => {
            if(field !== "_PK" && field !== "_SK" && field !== "_ENTITY") // não pode atualizar PPK e SK.
            {
                updExpression += ` #${field} = :${field},`;
                
                updNames[`#${field}`]  = field;
                updValues[`:${field}`] = value;
            }
        });

        const params = {
            TableName: this.TABLE_NAME,
            Key: {
                "_PK": this._data._PK as any,
                "_SK": this._data._SK as any
            },
            UpdateExpression: updExpression.replace(/,\s*$/, ""),
            ExpressionAttributeNames: updNames,
            ExpressionAttributeValues: updValues,
            ReturnValues: "ALL_NEW"
        } as UpdateCommandInput;

        if(ddbTrx) return params;

        await DDBCommom.Update(params);
        return true;

        // const res = await this._conn.update(params).promise();
        // return true;
    }

    async delete()
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

    async _deleteBatch(lst: IEntity[])
    {
        // split in chuncks of 25 (max batch write dynamodb limit)
        const chunks = _chunk(lst, 25);

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
    //#endregion
}

export const stringIsNotEmpty = (data: any) => data && typeof data === "string" && (data as string).trim().length;