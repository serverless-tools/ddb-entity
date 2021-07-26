import AEntity, { EEntity, IEntity } from "../AEntity";

import _set from "lodash/set";

interface IUser extends IEntity
{
    EMAIL: string
    NAME?: string
}

export default class PeopleModel extends AEntity<IUser>
{
    /** @override */
    readonly TABLE_NAME = "teste";
    readonly PK_DEFAULT = "[email]";

    //#region [Model attributes]

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

    //#region [Required override]

    constructor(json?: IUser)
    { 
        super(EEntity.PEOPLE, json);
    }

    //#endregion

    //#region [Validations]

    /** @override */
    validate()
    {
        super.validate();
    
        if(!this._data.EMAIL) throw "Email é obrigatório";
    }

    //#endregion

    //#region [Operations]
    
    /** @override */
    async get(email: string) 
    {
        const sk = this._SKcreate(email, EEntity.PEOPLE);
        const data = await super.get(email, sk);

        if(data) return new PeopleModel(data as IUser);
        
        return null;
    }

    static async Get(email: string) { return await (new PeopleModel()).get(email); }

    //#endregion

    //#region [Query]

    static async QueryByLastWeekCreations()
    {

    }

    //#endregion
}