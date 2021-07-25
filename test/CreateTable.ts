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
            "AttributeName": "PK",
            "KeyType": "HASH"
        },
        {
            "AttributeName": "SK",
            "KeyType": "RANGE"
        }
    ],
    "AttributeDefinitions": [
        {
            "AttributeName": "PK",
            "AttributeType": "S"
        },
        {
            "AttributeName": "SK",
            "AttributeType": "S"
        },
        {
            "AttributeName": "ENTITY",
            "AttributeType": "S"
        },
        {
            "AttributeName": "DT_CREATED",
            "AttributeType": "S"
        },
        {
            "AttributeName": "DT_MODIFIED",
            "AttributeType": "S"
        }
    ],
    "LocalSecondaryIndexes": [
        {
            "IndexName": EIndex.PK_DT_CREATED,
            "KeySchema": [
                {
                    "AttributeName": "PK",
                    "KeyType": "HASH"
                },
                {
                    "AttributeName": "DT_CREATED",
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
                    "AttributeName": "PK",
                    "KeyType": "HASH"
                },
                {
                    "AttributeName": "DT_MODIFIED",
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
                    "AttributeName": "ENTITY",
                    "KeyType": "HASH"
                },
                {
                    "AttributeName": "SK",
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