import { EEntity, IEntity } from "../AEntity";
import AEntityVersion from "../AEntityVersion";

import _set from "lodash/set";

interface IPage extends IEntity
{
    SLUG?: string
    
    TITLE?: string
    INTRO?: string
    BODY?: string

    HEAD?: string
    FROM?: string
}

export default class PageModel extends AEntityVersion<IPage>
{
    /** @override */
    readonly TABLE_NAME = "teste";
    readonly PK_DEFAULT = "PAGE";

    //#region [Model attributes]

    /**
     * If changed, in the existent page, new will be created.
     */ 
    setSlug(str: string)  
    {
        this._data.FROM = this._data.SK;
        this._data.SLUG = str;
        this.setSK(str, true);

        return this;
    }
    
    setTitle(str: string) { this._data.TITLE = str; return this; }
    setBody(str: string)  { this._data.BODY  = str; return this; }

    //#endregion

    //#region [Required override]

    constructor(json?: IPage)
    { 
        super(EEntity.PAGE, json);

        if( !this._data?.PK ) // Insert the required PK if its a new object.
            _set(this._data, "PK", this.PK_DEFAULT);
    }

    //#endregion

    //#region [Validations]

    /**
     * @override
     */
    validate()
    {
        super.validate();
    
        this.validateSlug();
        if(!this._data.TITLE) throw "Título é obrigatório";
        if(!this._data.BODY) throw "Corpo é obrigatório";
    }

    validateSlug()
    {
        if(!this._data.SLUG) throw "Slug é obrigatório";
        if(!/^[a-z0-9-]+$/.test(this._data.SLUG)) throw "Slug inválido (^[a-z0-9-]+$)";

        return true;
    }

    //#endregion

    //#region [Operations]
    
    /**
     * @override
     */ 
    async get(slug: string) 
    {
        const sk   = this._factorySK(slug, EEntity.PAGE);
        const data = await super.get(this.PK_DEFAULT, sk);

        if(data) return new PageModel(data);
        
        return null;
    }

    /** Get factory  */
    static async Get(slug: string) { return await (new PageModel()).get(slug); }

    //#endregion
}