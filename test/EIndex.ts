enum TBL_INDEXES 
{
    // Local indexes (insde a PK, max 10G, must be created on table creating)
    PK_DT_CREATED  = "PK-DT_CREATED-local",
    PK_DT_MODIFIED = "PK-DT_MODIFIED-local",
    
    // Glocal indexes
    ENTITY_SK = "ENTITY-SK",
};

export default TBL_INDEXES;