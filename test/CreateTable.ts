import AWS from "aws-sdk";

import EIndex from "./EIndex";
import PageModel from "./PageModel";

AWS.config.update({region: process.env.AWS_REGION || "us-east-1"});

var ddb = new AWS.DynamoDB();
var params = {
    "TableName": (new PageModel()).TABLE_NAME,
    "BillingMode": "PAY_PER_REQUEST",
    "KeySchema": [
        {
            "AttributeName": "_PK",
            "KeyType": "HASH"
        },
        {
            "AttributeName": "_SK",
            "KeyType": "RANGE"
        }
    ],
    "AttributeDefinitions": [
        {
            "AttributeName": "_PK",
            "AttributeType": "S"
        },
        {
            "AttributeName": "_SK",
            "AttributeType": "S"
        },
        {
            "AttributeName": "_ENTITY",
            "AttributeType": "S"
        },
        {
            "AttributeName": "_CREATED",
            "AttributeType": "S"
        },
        {
            "AttributeName": "_MODIFIED",
            "AttributeType": "S"
        }
    ],
    "LocalSecondaryIndexes": [
        {
            "IndexName": EIndex.PK_DT_CREATED,
            "KeySchema": [
                {
                    "AttributeName": "_PK",
                    "KeyType": "HASH"
                },
                {
                    "AttributeName": "_CREATED",
                    "KeyType": "RANGE"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        },
        {
            "IndexName": EIndex.PK_DT_MODIFIED,
            "KeySchema": [
                {
                    "AttributeName": "_PK",
                    "KeyType": "HASH"
                },
                {
                    "AttributeName": "_MODIFIED",
                    "KeyType": "RANGE"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        }
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": EIndex.ENTITY_SK,
            "KeySchema": [
                {
                    "AttributeName": "_ENTITY",
                    "KeyType": "HASH"
                },
                {
                    "AttributeName": "_SK",
                    "KeyType": "RANGE"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        }
    ]
};

(async () => {
    try
    {
        await ddb.createTable(params).promise();
        console.log("Table created!");
    }
    catch(e) 
    { 
        console.error(e);
    }
})()