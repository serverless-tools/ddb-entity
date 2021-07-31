# DynamoDB Enity (or simple ORM)

## Insert

```
const people = new People();

await people
    .setEmail("fulano@gmail.com")
    .setName("Alexandre Santos")
    .create();
```


## Get

```
const model: IPeople = await People.Get("fulano@gmail.com");
```

## Query

```
const model: IPeople[] = await People.QueryByName("Alex");
```

## Update

```
const model = await People.Get("fulano@gmail.com");

model.setName("Hello world")
await model.update();
```

## Delete

```
const model: IPeople = await People.Get("fulano@gmail.com");
await model.delete();
```

# Define your model

```typescript
import AEntity, { IEntity } from "ddb-entity/AEntity";

const ENTITY_NAME = "PEOPLE";

interface IUser extends IEntity
{
    EMAIL: string
    NAME?: string
}

export default class PeopleModel extends AEntity<IUser>
{
    /** @override */
    readonly TABLE_NAME = "TableName";

    /** @override */
    readonly PK_DEFAULT = "[email]";

//#region [Attributes]

    setEmail(email: string)
    {
        if(this._data.PK) throw "Can't change user email";

        this.setPK(email);
        this.setSK(email);
        this._data.EMAIL = email; 

        return this; 
    }

    setName(str: string) { this._data.NAME = str; return this; }

//#endregion

//#region [Required]

    constructor(json?: IUser)
    { 
        super(ENTITY_NAME, json);
    }

//#endregion

//#region [Validations]

    /** @override */
    validate()
    {
        super.validate(); // validate PK and SK
    
        if(!this._data.EMAIL) throw "Email is required";
    }

//#endregion

//#region [Operations]
    
    /**
     *  @override 
     * You should how to get your data through PK and SK.
     **/
    async get(email: string) 
    {
        const sk = this._SKcreate(email, ENTITY_NAME); // => ENTITY_NAME#email
        const data = await super.get(email, sk);

        if(data) return new PeopleModel(data as IUser);
        
        return null;
    }

    static async Get(email: string) { return await (new PeopleModel()).get(email); }

//#endregion
}
```

1. Define interface of your data extends from `IEntity`;
2. Define your Model class extends from `AEntity`.
3. Override constructor() method with a optional data/json paramter + call super("entity name", jsonParameter)
4. Override get() method (you should use PK and SK to get the document, use `super.get(pk, sk)`)
5. [optional] Create a static Get() and yours statics QueryByXXX() methods (see, example, in async query<T>(pk, sk) in AEntity.ts)

# AEntityVersion

You can extends from `AEntityVersion` to not allow updates, only new versions.  
More examples at `test/PageModel.ts` and `test/PageModel.test.ts`

```typescript
const SLUG = "about";

describe("page", async () => 
{
    it("create", async () => 
    {
        // instance of a new entity object 
        const page = new PageModel();

        // set attributes
        const res = await page
            .setSlug(SLUG)
            .setTitle("About me")
            .setBody("<p>Hello world</p>")
            .create();                      // insert into dynamodb

        ok(res, `Page save error`);
    });

    it("get", async () => 
    {
        const model = await PageModel.Get(SLUG);

        ok(model, `Page get error`);
    });

    it("create new version", async () => 
    {
        // get object (retruns null if not found)
        const model = await PageModel.Get(SLUG);

        if(!model) throw "Get failed";
        
        // Update properties
        model
            .setTitle("New title version")
            .setBody("<h1>Hello world</h1>");
        
        // create new version (don't overwrite)
        const res = await model.create();

        ok(res, `Page create new version`);
    });

    it("update slug", async () => 
    {
        const model = await PageModel.Get(SLUG);

        if(!model) throw "Get failed";

        // Update title and change slug (slug is key, so new register is inserted with reference to pior)
        model
            .setTitle("New slug version")
            .setSlug("novo");

        const res = await model.create();

        ok(res, `Page create new slug`);

        model.delete();
    });

    it("delete", async () => 
    {
        const model = await PageModel.Get(SLUG);

        if(!model) throw "Get failed";

        const res = await model.delete();

        ok(res, `Page delete`);
    });
});

```
