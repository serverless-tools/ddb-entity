import {describe, it} from "mocha";
import {ok} from "assert";
import PageModel from "./PageModel";

const log = (d:any) => console.log(d);

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

