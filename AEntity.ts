import _assignIn from "lodash/assignIn";
import _cloneDeep from "lodash/cloneDeep";
import _set from "lodash/set";
import _unset from "lodash/unset";
import _has from "lodash/has";
import _get from "lodash/get";
import _forOwn from "lodash/forOwn";

import { 
    PutCommandInput,
    UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

import EEntity from "./test/EEntity";
import { DDBCommom } from "./DDB";

export {EEntity};

export interface IEntity    // Base entity
{
    PK?: string 
    SK?: string 
    ENTITY?: string  // ex: ORDER, ORDER ITEM, WAIVER, BALANCE, TRANSACTION, PEOPLE, PAGE, etc.

    DT_CREATED?: string  // new Date().toISOString() => '2020-12-14T01:07:22.016Z' 
    DT_MODIFIED?: string // new Date().toISOString() => '2020-12-14T01:07:22.016Z' 
}

export default abstract class AEntity<T extends IEntity>
{
    abstract readonly TABLE_NAME: string;
    abstract readonly PK_DEFAULT: string;
    public   readonly SK_PATTERN: string; // defaults = "[type]#[sort]";
    
    // protected _conn : DocumentClient;
    public _data    : T;
    public ENTITY   : string;

    //#region [Main]

    constructor(type: string, json?: T, skPattern: string = "[type]#[sort]")
    {
        this.SK_PATTERN = skPattern;
        this.ENTITY     = type;
        this._data      = this._factoryData(json);
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
    protected _factoryData(json?: T)
    {
        let data = {} as T;

        if(json) data = _assignIn({}, json);

        return data;
    }

    /**
     * Generate a SK key string
     */ 
    protected _factorySK(sk: string, entity: string) : string // should be overwrite if yout skPattern is difrent that defaults ([type]#[sort])
    {
        return this.SK_PATTERN
            .replace("[type]", entity as string)
            .replace("[sort]", sk);
    }

    //#endregion

    //#region [Required Attributes]

    setPK(key: string)  
    { 
        this._data.PK = key; 
        return this;  
    }
    
    setSK(sort: string) 
    { 
        this._data.SK = this._factorySK(sort, this.ENTITY);
        return this;
    }

    protected setDtModifiedNow()
    {
        this._data.DT_MODIFIED = new Date().toISOString();
        return this;
    }

    protected setDtCreatedNow()
    {
        this._data.DT_CREATED = new Date().toISOString();
        return this;
    }

    setValue(field: string, value: string)
    {
        _set(this._data, field, value);
    }

    getValue(field: string)
    {
        if(_has(this._data, field))
            return _get(this._data, field);

        return null;
    }

    //#endregion

    //#region [Validations / Sanitizes]

    validate()
    {
        if(!stringIsNotEmpty(this._data.PK)) throw "PK Required";
        if(!stringIsNotEmpty(this._data.SK)) throw "SK Required";
    }

    //#endregion

    //#region [Operations]

    async get(pk: string, sk: string, consistentRead = false) 
    {
        const ret = await DDBCommom.Get({
            TableName: this.TABLE_NAME,
            ConsistentRead: consistentRead,
            Key: {
                PK: pk as any,
                SK: sk as any
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
            
            KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
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
    async create(checkExists: boolean = true, ddbTrx: boolean = false)
    {
        this.validate();
        this.setDtCreatedNow();

        const params = {
            TableName: this.TABLE_NAME,
            Item: this._data as any,
            ReturnConsumedCapacity: "TOTAL"
        } as PutCommandInput;

        if(checkExists)
            params.ConditionExpression = 'attribute_not_exists(PK) AND attribute_not_exists(SK)';

        if(ddbTrx) return params;

        return await DDBCommom.Put(params);
    }

    async update(ddbTrx: boolean = false) : Promise<boolean|UpdateCommandInput>
    {
        this.validate();
        this.setDtModifiedNow();

        let updExpression = "set ";
        let updNames  = {} as any;
        let updValues = {} as any;
        
        _forOwn(this._data, (value, field) => {
            if(field !== "PK" && field !== "SK") // não pode atualizar PPK e SK.
            {
                updExpression += ` #${field} = :${field},`;
                
                updNames[`#${field}`]  = field;
                updValues[`:${field}`] = value;
            }
        });

        const params = {
            TableName: this.TABLE_NAME,
            Key: {
                PK: this._data.PK as any,
                SK: this._data.SK as any
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
                PK: this._data.PK as any,
                SK: this._data.SK as any
            },
        });

        return true;
    }

    //#endregion
}

export const stringIsNotEmpty = (data: any) => data && typeof data === "string" && (data as string).trim().length;