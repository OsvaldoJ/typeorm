import {EntityMetadata} from "../metadata/EntityMetadata";
import {NamingStrategyInterface} from "../naming-strategy/NamingStrategyInterface";
import {ColumnMetadata} from "../metadata/ColumnMetadata";
import {IndexMetadata} from "../metadata/IndexMetadata";
import {RelationMetadata} from "../metadata/RelationMetadata";
import {EmbeddedMetadata} from "../metadata/EmbeddedMetadata";
import {MetadataArgsStorage} from "../metadata-args/MetadataArgsStorage";
import {LazyRelationsWrapper} from "../lazy-loading/LazyRelationsWrapper";
import {Driver} from "../driver/Driver";
import {EmbeddedMetadataArgs} from "../metadata-args/EmbeddedMetadataArgs";
import {RelationIdMetadata} from "../metadata/RelationIdMetadata";
import {RelationCountMetadata} from "../metadata/RelationCountMetadata";
import {MetadataUtils} from "../metadata-args/MetadataUtils";
import {TableMetadataArgs} from "../metadata-args/TableMetadataArgs";
import {JunctionEntityMetadataBuilder} from "./JunctionEntityMetadataBuilder";
import {ClosureJunctionEntityMetadataBuilder} from "./ClosureJunctionEntityMetadataBuilder";
import {RelationJoinColumnBuilder} from "./RelationJoinColumnBuilder";

/**
 * Aggregates all metadata: table, column, relation into one collection grouped by tables for a given set of classes.
 */
export class AllEntityMetadataBuilder {

    // todo: type in function validation, inverse side function validation
    // todo: check on build for duplicate names, since naming checking was removed from MetadataStorage
    // todo: duplicate name checking for: table, relation, column, index, naming strategy, join tables/columns?
    // todo: check if multiple tree parent metadatas in validator
    // todo: tree decorators can be used only on closure table (validation)
    // todo: throw error if parent tree metadata was not specified in a closure table

    // -------------------------------------------------------------------------
    // Protected Properties
    // -------------------------------------------------------------------------

    protected junctionEntityMetadataBuilder: JunctionEntityMetadataBuilder;
    protected closureJunctionEntityMetadataBuilder: ClosureJunctionEntityMetadataBuilder;
    protected relationJoinColumnBuilder: RelationJoinColumnBuilder;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(private driver: Driver,
                private lazyRelationsWrapper: LazyRelationsWrapper,
                private metadataArgsStorage: MetadataArgsStorage,
                private namingStrategy: NamingStrategyInterface) {
        this.junctionEntityMetadataBuilder = new JunctionEntityMetadataBuilder(driver, lazyRelationsWrapper, namingStrategy);
        this.closureJunctionEntityMetadataBuilder = new ClosureJunctionEntityMetadataBuilder(driver, lazyRelationsWrapper, namingStrategy);
        this.relationJoinColumnBuilder = new RelationJoinColumnBuilder(namingStrategy);
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Builds a complete entity metadatas for the given entity classes.
     */
    build(entityClasses?: Function[]): EntityMetadata[] {

        // if entity classes to filter entities by are given then do filtering, otherwise use all
        const allTables = entityClasses ? this.metadataArgsStorage.filterTables(entityClasses) : this.metadataArgsStorage.tables.toArray();

        // filter out table metadata args for those we really create entity metadatas and tables in the db
        const realTables = allTables.filter(table => table.type === "regular" || table.type === "closure" || table.type === "class-table-child");

        // create entity metadatas for a user defined entities (marked with @Entity decorator or loaded from entity schemas)
        const entityMetadatas = realTables.map(tableArgs => this.createEntityMetadata(tableArgs));

        // calculate entity metadata computed properties and all its sub-metadatas
        entityMetadatas.forEach(entityMetadata => this.computeEntityMetadata(entityMetadata));

        // calculate entity metadata's inverse properties
        entityMetadatas.forEach(entityMetadata => this.computeInverseProperties(entityMetadata, entityMetadatas));

        // go through all entity metadatas and create foreign keys / junction entity metadatas for their relations
        entityMetadatas.forEach(entityMetadata => {

            // create entity's relations join columns (for many-to-one and one-to-one owner)
            entityMetadata.relations.filter(relation => relation.isOneToOne || relation.isManyToOne).forEach(relation => {
                const joinColumns = this.metadataArgsStorage.filterJoinColumns(relation.target, relation.propertyName);
                const foreignKey = this.relationJoinColumnBuilder.build(joinColumns, relation); // create a foreign key based on its metadata args
                if (foreignKey) {
                    relation.registerForeignKeys(foreignKey); // push it to the relation and thus register there a join column
                    entityMetadata.foreignKeys.push(foreignKey);
                }
            });

            // create junction entity metadatas for entity many-to-many relations
            entityMetadata.relations.filter(relation => relation.isManyToMany).forEach(relation => {
                const joinTable = this.metadataArgsStorage.findJoinTable(relation.target, relation.propertyName);
                if (!joinTable) return; // no join table set - no need to do anything (it means this is many-to-many inverse side)

                // here we create a junction entity metadata for a new junction table of many-to-many relation
                const junctionEntityMetadata = this.junctionEntityMetadataBuilder.build(relation, joinTable);
                relation.registerForeignKeys(...junctionEntityMetadata.foreignKeys);
                relation.junctionEntityMetadata = junctionEntityMetadata;
                if (relation.inverseRelation)
                    relation.inverseRelation.junctionEntityMetadata = junctionEntityMetadata;

                // compute new entity metadata properties and push it to entity metadatas pool
                this.computeEntityMetadata(junctionEntityMetadata);
                this.computeInverseProperties(junctionEntityMetadata, entityMetadatas);
                entityMetadatas.push(junctionEntityMetadata);
            });

            // update entity metadata depend properties
            entityMetadata.relationsWithJoinColumns = entityMetadata.relations.filter(relation => relation.isWithJoinColumn);
            entityMetadata.hasNonNullableRelations = entityMetadata.relationsWithJoinColumns.some(relation => !relation.isNullable || relation.isPrimary);
        });

        // generate closure junction tables for all closure tables
        entityMetadatas
            .filter(metadata => metadata.isClosure)
            .forEach(entityMetadata => {
                const closureJunctionEntityMetadata = this.closureJunctionEntityMetadataBuilder.build(entityMetadata);
                entityMetadata.closureJunctionTable = closureJunctionEntityMetadata;
                this.computeEntityMetadata(closureJunctionEntityMetadata);
                this.computeInverseProperties(closureJunctionEntityMetadata, entityMetadatas);
                entityMetadatas.push(closureJunctionEntityMetadata);
            });

        // generate keys for tables with single-table inheritance
        entityMetadatas
            .filter(metadata => metadata.inheritanceType === "single-table")
            .forEach(entityMetadata => this.createKeysForTableInheritance(entityMetadata));

        // add lazy initializer for entity relations
        entityMetadatas
            .filter(metadata => metadata.target instanceof Function)
            .forEach(entityMetadata => {
                entityMetadata.relations
                    .filter(relation => relation.isLazy)
                    .forEach(relation => {
                        this.lazyRelationsWrapper.wrap((entityMetadata.target as Function).prototype, relation);
                    });
            });

        return entityMetadatas;
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    /**
     * Creates entity metadata from the given table args.
     * Creates column, relation, etc. metadatas for everything this entity metadata owns.
     */
    protected createEntityMetadata(tableArgs: TableMetadataArgs): EntityMetadata {

        // we take all "inheritance tree" from a target entity to collect all stored metadata args
        // (by decorators or inside entity schemas). For example for target Post < ContentModel < Unit
        // it will be an array of [Post, ContentModel, Unit] and we can then get all metadata args of those classes
        const inheritanceTree = tableArgs.target instanceof Function
            ? MetadataUtils.getInheritanceTree(tableArgs.target)
            : [tableArgs.target]; // todo: implement later here inheritance for string-targets

        const entityMetadata = new EntityMetadata({
            namingStrategy: this.namingStrategy,
            lazyRelationsWrapper: this.lazyRelationsWrapper,
            tablesPrefix: this.driver.options.tablesPrefix,
            args: tableArgs
        });
        entityMetadata.embeddeds = this.createEmbeddedsRecursively(entityMetadata, this.metadataArgsStorage.filterEmbeddeds(inheritanceTree));

        entityMetadata.ownColumns = this.metadataArgsStorage.filterColumns(inheritanceTree).map(args => {
            return new ColumnMetadata({ entityMetadata, args });
        });
        entityMetadata.ownRelations = this.metadataArgsStorage.filterRelations(inheritanceTree).map(args => {
            return new RelationMetadata({ entityMetadata, args });
        });
        entityMetadata.relationIds = this.metadataArgsStorage.filterRelationIds(inheritanceTree).map(args => {
            return new RelationIdMetadata({ entityMetadata, args });
        });
        entityMetadata.relationCounts = this.metadataArgsStorage.filterRelationCounts(inheritanceTree).map(args => {
            return new RelationCountMetadata({ entityMetadata, args });
        });
        entityMetadata.indices = this.metadataArgsStorage.filterIndices(inheritanceTree).map(args => {
            return new IndexMetadata({ entityMetadata, args });
        });
        return entityMetadata;
    }

    /**
     * Creates from the given embedded metadata args real embedded metadatas with its columns and relations,
     * and does the same for all its sub-embeddeds (goes recursively).
     */
    protected createEmbeddedsRecursively(entityMetadata: EntityMetadata, embeddedArgs: EmbeddedMetadataArgs[]): EmbeddedMetadata[] {
        return embeddedArgs.map(embeddedArgs => {
            const embeddedMetadata = new EmbeddedMetadata({ entityMetadata: entityMetadata, args: embeddedArgs });
            embeddedMetadata.columns = this.metadataArgsStorage.filterColumns(embeddedMetadata.type).map(args => {
                return new ColumnMetadata({ entityMetadata, embeddedMetadata, args});
            });
            embeddedMetadata.relations = this.metadataArgsStorage.filterRelations(embeddedMetadata.type).map(args => {
                return new RelationMetadata({ entityMetadata, embeddedMetadata, args });
            });
            embeddedMetadata.embeddeds = this.createEmbeddedsRecursively(entityMetadata, this.metadataArgsStorage.filterEmbeddeds(embeddedMetadata.type));
            embeddedMetadata.embeddeds.forEach(subEmbedded => subEmbedded.parentEmbeddedMetadata = embeddedMetadata);
            return embeddedMetadata;
        });
    }

    /**
     * Computes all entity metadata's computed properties, and all its sub-metadatas (relations, columns, embeds, etc).
     */
    protected computeEntityMetadata(entityMetadata: EntityMetadata) {
        entityMetadata.embeddeds.forEach(embedded => embedded.build(this.namingStrategy));
        entityMetadata.embeddeds.forEach(embedded => {
            embedded.columnsFromTree.forEach(column => column.build(this.namingStrategy));
            embedded.relationsFromTree.forEach(relation => relation.build(this.namingStrategy));
        });
        entityMetadata.ownColumns.forEach(column => column.build(this.namingStrategy));
        entityMetadata.ownRelations.forEach(relation => relation.build(this.namingStrategy));
        entityMetadata.relations = entityMetadata.embeddeds.reduce((relations, embedded) => relations.concat(embedded.relationsFromTree), entityMetadata.ownRelations);
        entityMetadata.oneToOneRelations = entityMetadata.relations.filter(relation => relation.isOneToOne);
        entityMetadata.oneToManyRelations = entityMetadata.relations.filter(relation => relation.isOneToMany);
        entityMetadata.manyToOneRelations = entityMetadata.relations.filter(relation => relation.isManyToOne);
        entityMetadata.manyToManyRelations = entityMetadata.relations.filter(relation => relation.isManyToMany);
        entityMetadata.ownerOneToOneRelations = entityMetadata.relations.filter(relation => relation.isOneToOneOwner);
        entityMetadata.ownerManyToManyRelations = entityMetadata.relations.filter(relation => relation.isManyToManyOwner);
        entityMetadata.treeParentRelation = entityMetadata.relations.find(relation => relation.isTreeParent)!; // todo: fix ! later
        entityMetadata.treeChildrenRelation = entityMetadata.relations.find(relation => relation.isTreeChildren)!; // todo: fix ! later
        entityMetadata.columns = entityMetadata.embeddeds.reduce((columns, embedded) => columns.concat(embedded.columnsFromTree), entityMetadata.ownColumns);
        entityMetadata.primaryColumns = entityMetadata.columns.filter(column => column.isPrimary);
        entityMetadata.hasMultiplePrimaryKeys = entityMetadata.primaryColumns.length > 1;
        entityMetadata.generatedColumn = entityMetadata.columns.find(column => column.isGenerated)!; // todo: fix ! later
        entityMetadata.createDateColumn = entityMetadata.columns.find(column => column.mode === "createDate")!; // todo: fix ! later
        entityMetadata.updateDateColumn = entityMetadata.columns.find(column => column.mode === "updateDate")!; // todo: fix ! later
        entityMetadata.versionColumn = entityMetadata.columns.find(column => column.mode === "version")!; // todo: fix ! later
        entityMetadata.discriminatorColumn = entityMetadata.columns.find(column => column.mode === "discriminator")!; // todo: fix ! later
        entityMetadata.treeLevelColumn = entityMetadata.columns.find(column => column.mode === "treeLevel")!; // todo: fix ! later
        entityMetadata.parentIdColumns = entityMetadata.columns.filter(column => column.mode === "parentId")!; // todo: fix ! later
        entityMetadata.objectIdColumn = entityMetadata.columns.find(column => column.mode === "objectId")!; // todo: fix ! later
        entityMetadata.foreignKeys.forEach(foreignKey => foreignKey.build(this.namingStrategy));
        entityMetadata.indices.forEach(index => index.build(this.namingStrategy));
        entityMetadata.propertiesMap = entityMetadata.createPropertiesMap();
    }

    /**
     * Computes entity metadata's relations inverse side properties.
     */
    protected computeInverseProperties(entityMetadata: EntityMetadata, entityMetadatas: EntityMetadata[]) {
        entityMetadata.relations.forEach(relation => {

            // compute inverse side (related) entity metadatas for all relation metadatas
            const inverseEntityMetadata = entityMetadatas.find(m => m.target === relation.type || (typeof relation.type === "string" && m.targetName === relation.type));
            if (!inverseEntityMetadata)
                throw new Error("Entity metadata for " + entityMetadata.name + "#" + relation.propertyPath + " was not found. Check if you specified a correct entity object, check its really entity and its connected in the connection options.");

            relation.inverseEntityMetadata = inverseEntityMetadata;
            relation.inverseSidePropertyPath = relation.buildInverseSidePropertyPath();

            // and compute inverse relation and mark if it has such
            relation.inverseRelation = inverseEntityMetadata.relations.find(foundRelation => foundRelation.propertyPath === relation.inverseSidePropertyPath)!; // todo: remove ! later
            relation.hasInverseSide = !!relation.inverseRelation; // todo: do we really need this flag
        });
    }

    protected createKeysForTableInheritance(entityMetadata: EntityMetadata) {
        const indexForKey = new IndexMetadata({
            entityMetadata: entityMetadata,
            columns: [entityMetadata.discriminatorColumn],
            args: {
                target: entityMetadata.target,
                unique: false
            }
        });
        entityMetadata.indices.push(indexForKey);

        const indexForKeyWithPrimary = new IndexMetadata({
            entityMetadata: entityMetadata,
            columns: [entityMetadata.primaryColumns[0], entityMetadata.discriminatorColumn],
            args: {
                target: entityMetadata.target,
                unique: false
            }
        });
        entityMetadata.indices.push(indexForKeyWithPrimary);
    }

}

// generate virtual column with foreign key for class-table inheritance
/*entityMetadatas.forEach(entityMetadata => {
 if (!entityMetadata.parentEntityMetadata)
 return;

 const parentPrimaryColumns = entityMetadata.parentEntityMetadata.primaryColumns;
 const parentIdColumns = parentPrimaryColumns.map(primaryColumn => {
 const columnName = this.namingStrategy.classTableInheritanceParentColumnName(entityMetadata.parentEntityMetadata.tableName, primaryColumn.propertyName);
 const column = new ColumnMetadataBuilder(entityMetadata);
 column.type = primaryColumn.type;
 column.propertyName = primaryColumn.propertyName; // todo: check why needed
 column.givenName = columnName;
 column.mode = "parentId";
 column.isUnique = true;
 column.isNullable = false;
 // column.entityTarget = entityMetadata.target;
 return column;
 });

 // add foreign key
 const foreignKey = new ForeignKeyMetadataBuilder(
 entityMetadata,
 parentIdColumns,
 entityMetadata.parentEntityMetadata,
 parentPrimaryColumns,
 "CASCADE"
 );
 entityMetadata.ownColumns.push(...parentIdColumns);
 entityMetadata.foreignKeys.push(foreignKey);
 });*/


/*protected createEntityMetadata(metadata: EntityMetadata, options: {
 userSpecifiedTableName?: string,
 closureOwnerTableName?: string,
 }) {

 const tableNameUserSpecified = options.userSpecifiedTableName;
 const isClosureJunction = metadata.tableType === "closure-junction";
 const targetName = metadata.target instanceof Function ? (metadata.target as any).name : metadata.target;
 const tableNameWithoutPrefix = isClosureJunction
 ? this.namingStrategy.closureJunctionTableName(options.closureOwnerTableName!)
 : this.namingStrategy.tableName(targetName, options.userSpecifiedTableName);

 const tableName = this.namingStrategy.prefixTableName(this.driver.options.tablesPrefix, tableNameWithoutPrefix);

 // for virtual tables (like junction table) target is equal to undefined at this moment
 // we change this by setting virtual's table name to a target name
 // todo: add validation so targets with same schema names won't conflicts with virtual table names
 metadata.target = metadata.target ? metadata.target : tableName;
 metadata.targetName = targetName;
 metadata.givenTableName = tableNameUserSpecified;
 metadata.tableNameWithoutPrefix = tableNameWithoutPrefix;
 metadata.tableName = tableName;
 metadata.name = targetName ? targetName : tableName;
 // metadata.namingStrategy = this.namingStrategy;
 }*/

/*protected createEntityMetadata(tableArgs: any, argsForTable: any, ): EntityMetadata {
 const metadata = new EntityMetadata({
 junction: false,
 target: tableArgs.target,
 tablesPrefix: this.driver.options.tablesPrefix,
 namingStrategy: this.namingStrategy,
 tableName: argsForTable.name,
 tableType: argsForTable.type,
 orderBy: argsForTable.orderBy,
 engine: argsForTable.engine,
 skipSchemaSync: argsForTable.skipSchemaSync,
 columnMetadatas: columns,
 relationMetadatas: relations,
 relationIdMetadatas: relationIds,
 relationCountMetadatas: relationCounts,
 indexMetadatas: indices,
 embeddedMetadatas: embeddeds,
 inheritanceType: mergedArgs.inheritance ? mergedArgs.inheritance.type : undefined,
 discriminatorValue: discriminatorValueArgs ? discriminatorValueArgs.value : (tableArgs.target as any).name // todo: pass this to naming strategy to generate a name
 }, this.lazyRelationsWrapper);
 return metadata;
 }*/


// const tables = [mergedArgs.table].concat(mergedArgs.children);
// tables.forEach(tableArgs => {

// find embeddable tables for embeddeds registered in this table and create EmbeddedMetadatas from them
// const findEmbeddedsRecursively = (embeddedArgs: EmbeddedMetadataArgs[]) => {
//     const embeddeds: EmbeddedMetadata[] = [];
//     embeddedArgs.forEach(embedded => {
//         const embeddableTable = embeddableMergedArgs.find(embeddedMergedArgs => embeddedMergedArgs.table.target === embedded.type());
//         if (embeddableTable) {
//             const columns = embeddableTable.columns.toArray().map(args => new ColumnMetadata(args));
//             const relations = embeddableTable.relations.toArray().map(args => new RelationMetadata(args));
//             const subEmbeddeds = findEmbeddedsRecursively(embeddableTable.embeddeds.toArray());
//             embeddeds.push(new EmbeddedMetadata(columns, relations, subEmbeddeds, embedded));
//         }
//     });
//     return embeddeds;
// };
// const embeddeds = findEmbeddedsRecursively(mergedArgs.embeddeds.toArray());

// create metadatas from args
// const argsForTable = mergedArgs.inheritance && mergedArgs.inheritance.type === "single-table" ? mergedArgs.table : tableArgs;

// const table = new TableMetadata(argsForTable);
// const columns = mergedArgs.columns.toArray().map(args => {
//
//     // if column's target is a child table then this column should have all nullable columns
//     if (mergedArgs.inheritance &&
//         mergedArgs.inheritance.type === "single-table" &&
//         args.target !== mergedArgs.table.target && !!mergedArgs.children.find(childTable => childTable.target === args.target)) {
//         args.options.nullable = true;
//     }
//     return new ColumnMetadata(args);
// });
// const discriminatorValueArgs = mergedArgs.discriminatorValues.find(discriminatorValueArgs => {
//     return discriminatorValueArgs.target === tableArgs.target;
// });



// after all metadatas created we set parent entity metadata for class-table inheritance
// entityMetadatas.forEach(entityMetadata => {
//     const mergedArgs = realTables.find(args => args.target === entityMetadata.target);
//     if (mergedArgs && mergedArgs.parent) {
//         const parentEntityMetadata = entityMetadatas.find(entityMetadata => entityMetadata.target === (mergedArgs!.parent! as any).target); // todo: weird compiler error here, thats why type casing is used
//         if (parentEntityMetadata)
//             entityMetadata.parentEntityMetadata = parentEntityMetadata;
//     }
// });