// import { DynamoDB } from "aws-sdk";
// import { 
//     DocumentClient,
//     GetItemInput, QueryInput, 
//     TransactWriteItemsInput 
// } from "aws-sdk/clients/dynamodb";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { 
    DynamoDBDocumentClient,
    GetCommand, GetCommandInput,
    PutCommand, PutCommandInput,
    UpdateCommand, UpdateCommandInput,
    DeleteCommand, DeleteCommandInput,
    QueryCommand, QueryCommandInput,
    BatchWriteCommand, BatchWriteCommandInput,
    TransactWriteCommand, TransactWriteCommandInput
} from "@aws-sdk/lib-dynamodb"; 

const DEBUG = false;

const marshallOptions = {
    // Whether to automatically convert empty strings, blobs, and sets to `null`.
    convertEmptyValues: false, // false, by default.
    // Whether to remove undefined values while marshalling.
    removeUndefinedValues: true, // false, by default.
    // Whether to convert typeof object to map attribute.
    convertClassInstanceToMap: false, // false, by default.
};

const unmarshallOptions = {
    // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
    wrapNumbers: false, // false, by default.
};

let ddbConn : DynamoDBClient|null = null;           // DynamoDB connection
let ddbDoc  : DynamoDBDocumentClient|null = null;   // DynamoDB document 

export const getConn = () => 
{
    if(ddbDoc) return ddbDoc;

    if(!ddbConn)
    {
        ddbConn = new DynamoDBClient({
            region: process.env.AWS_REGION || "us-east-1"
        });
    }

    ddbDoc = DynamoDBDocumentClient.from(ddbConn, {marshallOptions, unmarshallOptions});
    return ddbDoc;
}

export class DDBCommom
{
    public static async Get(params: GetCommandInput)
    {
        const ret = await (await getConn()).send(new GetCommand(params));
        
        if(!ret.Item)
            return null;

        return ret.Item;
    }

    public static async Query_First(params: QueryCommandInput)
    {
        const ret = await (await getConn()).send(new QueryCommand(params));
        
        if(!ret.Items?.length)
            return null;

        return ret.Items[0];
    }

    /**
     * Busca todos os items da query. 
     * Se o resultado vier paginado, busca todos os itens 
     * de toda as páginas.
     * 
     * DynamoDB retorna no máximo 1MB por página.
     * 
     * Filter Expression pode trazer páginas inteiras 
     * sem itens (a PK/SK encontraram itens mas o 
     * filter expression removeu antes de retornar)
     * esse comportamento é tratado e o resultado é sempre
     * um array onde todas as posições tem dados. 
     * 
     * @param params 
     * @param limit
     */
    public static async Query<T>(params: QueryCommandInput, limit = 200)
    {
        const ddb = await getConn();

        let ret = await ddb.send(new QueryCommand(params));
        // await dbConn.query(params).promise();   
        if(!ret || !ret.Items || !ret.Items.length && !ret.LastEvaluatedKey) return [];

        if(ret.ConsumedCapacity && DEBUG) 
        {
            DEBUG && console.debug("_DDB_Query :: ConsumedCapacity", {
                Count: ret.Count,
                ScannedCount: ret.ScannedCount,
                ConsumedCapacity: ret.ConsumedCapacity
            } as any);
            DEBUG && console.debug("_DDB_Query :: Query", params);
        }

        const lst = [];
        lst.push(...ret.Items);

        while(
                ret.LastEvaluatedKey 
            &&  (lst.length < limit || limit == 0)
        )
        {
            params.ExclusiveStartKey = ret.LastEvaluatedKey;
            
            ret = await ddb.send(new QueryCommand(params));

            if(ret && ret.Items && ret.Items.length) lst.push(...ret.Items);
        }

        return lst as T[];
    }

    public static async Put(params: PutCommandInput)
    {
        const ddb = await getConn();
        return await ddb.send(new PutCommand(params));
    }

    public static async Update(params: UpdateCommandInput)
    {
        const ddb = await getConn();
        return await ddb.send(new UpdateCommand(params));
    }

    public static async Delete(params: DeleteCommandInput)
    {
        const ddb = await getConn();
        return await ddb.send(new DeleteCommand(params));
    }

    public static async BatchWrite(params: BatchWriteCommandInput)
    {
        const ddb = await getConn();
        return await ddb.send(new BatchWriteCommand(params));
    }

    public static async Transaction(transaction: TransactWriteCommandInput)
    {
        const ddb = await getConn();
        return await ddb.send(new TransactWriteCommand(transaction));
        
        // let ret = null;
        // try
        // {
        //     // Inspirado em : https://github.com/aws/aws-sdk-js/issues/2464
        //     const fnExecutar = () => 
        //     {
        //         return new Promise((done, erro) => 
        //         {
        //             // console.log(transaction);
                    
        //             const dbreq = ddb.transactWrite(transaction);
        //             let cancellationReasons: any;

        //             dbreq.on("extractError", (response) => {
        //                 try 
        //                 {
        //                     cancellationReasons = JSON.parse(response.httpResponse.body.toString()).CancellationReasons;
        //                 } 
        //                 catch (err) 
        //                 {
        //                     console.error('Error extraindo motivo de cancellation error: ', err);
        //                 }
        //             });

        //             dbreq.send((err, response) => {
        //                 if(err)
        //                 {
        //                     console.error("erro no transactWrite: ", {err, cancellationReasons});

        //                     if(cancellationReasons)
        //                         erro(cancellationReasons);
        //                     else
        //                         erro(err);
        //                 }

        //                 done(response);
        //             });
        //         });
        //     };

        //     ret = await fnExecutar();
        // }
        // catch(e)
        // {
        //     throw e;
        // }

        // return ret;
    }
}