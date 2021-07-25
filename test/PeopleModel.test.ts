import {describe, it} from "mocha";
import {ok} from "assert";
import People from "./PeopleModel";

const log = (d:any) => console.log(d);

const EMAIL = "alsantos123@gmail.com";
const NAME = "Alexandre Santos";

describe("people", async () => 
{
    it("create", async () => 
    {
        const page = new People();

        const ret = await page
            .setEmail(EMAIL)
            .setName(NAME)
            .create();

        ok(ret, `People save error`);
    });

    it("get", async () => 
    {
        const model = await People.Get(EMAIL);

        console.log(model);

        ok(model, `People get`);
    });

    it("update name", async () => 
    {
        const model = await People.Get(EMAIL);
        
        if(!model) throw "Get failed";

        model.setName("Olá mundo")
        const res = await model.update();

        ok(res, `People update name`);
    });

    it("delete", async () => 
    {
        const model = await People.Get(EMAIL);
        let res;

        if(!model) throw "Get failed";

        res = await model.delete();

        ok(res, `People delete`);
    });
});

