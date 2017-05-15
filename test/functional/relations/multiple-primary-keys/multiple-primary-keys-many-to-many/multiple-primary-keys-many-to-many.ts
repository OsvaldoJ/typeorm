import "reflect-metadata";
import * as chai from "chai";
import {expect} from "chai";
import {closeTestingConnections, createTestingConnections, reloadTestingDatabases} from "../../../../utils/test-utils";
import {Connection} from "../../../../../src/connection/Connection";
import {Post} from "./entity/Post";
import {Category} from "./entity/Category";
import {Tag} from "./entity/Tag";

const should = chai.should();

describe("relations > multiple-primary-keys > many-to-many", () => {
    
    let connections: Connection[];
    before(async () => connections = await createTestingConnections({
        entities: [__dirname + "/entity/*{.js,.ts}"],
        schemaCreate: true,
        dropSchemaOnConnection: true,
    }));
    beforeEach(() => reloadTestingDatabases(connections));
    after(() => closeTestingConnections(connections));

    describe("owning side", () => {

        it("should load related entity when JoinTable used without options", () => Promise.all(connections.map(async connection => {

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "BMW";
            category2.type = "cars-category";
            category2.code = 2;
            category2.version = 1;
            await connection.manager.persist(category2);

            const category3 = new Category();
            category3.name = "airplanes";
            category3.type = "common-category";
            category3.code = 3;
            category3.version = 1;
            await connection.manager.persist(category3);

            const post1 = new Post();
            post1.title = "About BMW";
            post1.categories = [category1, category2];
            await connection.manager.persist(post1);

            const post2 = new Post();
            post2.title = "About Boeing";
            post2.categories = [category3];
            await connection.manager.persist(post2);

            const loadedPosts = await connection.manager
                .createQueryBuilder(Post, "post")
                .leftJoinAndSelect("post.categories", "categories")
                .orderBy("post.id, categories.code")
                .getMany();

            expect(loadedPosts[0].categories).to.not.be.empty;
            expect(loadedPosts[0].categories[0].name).to.be.equal("cars");
            expect(loadedPosts[0].categories[0].type).to.be.equal("common-category");
            expect(loadedPosts[0].categories[1].name).to.be.equal("BMW");
            expect(loadedPosts[0].categories[1].type).to.be.equal("cars-category");
            expect(loadedPosts[1].categories).to.not.be.empty;
            expect(loadedPosts[1].categories[0].name).to.be.equal("airplanes");
            expect(loadedPosts[1].categories[0].type).to.be.equal("common-category");

            const loadedPost = await connection.manager
                .createQueryBuilder(Post, "post")
                .leftJoinAndSelect("post.categories", "categories")
                .orderBy("categories.code")
                .where("post.id = :id", { id: 1 })
                .getOne();

            expect(loadedPost!.categories).to.not.be.empty;
            expect(loadedPost!.categories[0].name).to.be.equal("cars");
            expect(loadedPost!.categories[0].type).to.be.equal("common-category");

        })));

        it("should load related entity when JoinTable used with options", () => Promise.all(connections.map(async connection => {

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "BMW";
            category2.type = "cars-category";
            category2.code = 2;
            category2.version = 1;
            await connection.manager.persist(category2);

            const category3 = new Category();
            category3.name = "airplanes";
            category3.type = "common-category";
            category3.code = 3;
            category3.version = 1;
            await connection.manager.persist(category3);

            const post1 = new Post();
            post1.title = "About BMW";
            post1.categoriesWithOptions = [category1, category2];
            await connection.manager.persist(post1);

            const post2 = new Post();
            post2.title = "About Boeing";
            post2.categoriesWithOptions = [category3];
            await connection.manager.persist(post2);

            const loadedPosts = await connection.manager
                .createQueryBuilder(Post, "post")
                .leftJoinAndSelect("post.categoriesWithOptions", "categories")
                .orderBy("post.id, categories.code")
                .getMany();

            expect(loadedPosts[0].categoriesWithOptions).to.not.be.empty;
            expect(loadedPosts[0].categoriesWithOptions[0].name).to.be.equal("cars");
            expect(loadedPosts[0].categoriesWithOptions[0].type).to.be.equal("common-category");
            expect(loadedPosts[0].categoriesWithOptions[1].name).to.be.equal("BMW");
            expect(loadedPosts[0].categoriesWithOptions[1].type).to.be.equal("cars-category");
            expect(loadedPosts[1].categoriesWithOptions).to.not.be.empty;
            expect(loadedPosts[1].categoriesWithOptions[0].name).to.be.equal("airplanes");
            expect(loadedPosts[1].categoriesWithOptions[0].type).to.be.equal("common-category");

            const loadedPost = await connection.manager
                .createQueryBuilder(Post, "post")
                .leftJoinAndSelect("post.categoriesWithOptions", "categories")
                .orderBy("categories.code")
                .where("post.id = :id", { id: 1 })
                .getOne();

            expect(loadedPost!.categoriesWithOptions).to.not.be.empty;
            expect(loadedPost!.categoriesWithOptions[0].name).to.be.equal("cars");
            expect(loadedPost!.categoriesWithOptions[0].type).to.be.equal("common-category");

        })));

        it("should load related entity when JoinTable references with non-primary columns", () => Promise.all(connections.map(async connection => {

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            category1.description = "category of cars";
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "BMW";
            category2.type = "cars-category";
            category2.code = 2;
            category2.version = 1;
            category2.description = "category of BMW";
            await connection.manager.persist(category2);

            const category3 = new Category();
            category3.name = "airplanes";
            category3.type = "common-category";
            category3.code = 3;
            category3.version = 1;
            category3.description = "category of airplanes";
            await connection.manager.persist(category3);

            const post1 = new Post();
            post1.title = "About BMW";
            post1.categoriesWithNonPrimaryColumns = [category1, category2];
            await connection.manager.persist(post1);

            const post2 = new Post();
            post2.title = "About Boeing";
            post2.categoriesWithNonPrimaryColumns = [category3];
            await connection.manager.persist(post2);

            const loadedPosts = await connection.manager
                .createQueryBuilder(Post, "post")
                .leftJoinAndSelect("post.categoriesWithNonPrimaryColumns", "categories")
                .orderBy("post.id, categories.code")
                .getMany();

            expect(loadedPosts[0].categoriesWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedPosts[0].categoriesWithNonPrimaryColumns[0].code).to.be.equal(1);
            expect(loadedPosts[0].categoriesWithNonPrimaryColumns[0].version).to.be.equal(1);
            expect(loadedPosts[0].categoriesWithNonPrimaryColumns[0].description).to.be.equal("category of cars");
            expect(loadedPosts[0].categoriesWithNonPrimaryColumns[1].code).to.be.equal(2);
            expect(loadedPosts[0].categoriesWithNonPrimaryColumns[1].version).to.be.equal(1);
            expect(loadedPosts[0].categoriesWithNonPrimaryColumns[1].description).to.be.equal("category of BMW");
            expect(loadedPosts[1].categoriesWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedPosts[1].categoriesWithNonPrimaryColumns[0].code).to.be.equal(3);
            expect(loadedPosts[1].categoriesWithNonPrimaryColumns[0].version).to.be.equal(1);
            expect(loadedPosts[1].categoriesWithNonPrimaryColumns[0].description).to.be.equal("category of airplanes");

            const loadedPost = await connection.manager
                .createQueryBuilder(Post, "post")
                .leftJoinAndSelect("post.categoriesWithNonPrimaryColumns", "categories")
                .orderBy("categories.code")
                .where("post.id = :id", { id: 1 })
                .getOne();

            expect(loadedPost!.categoriesWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedPost!.categoriesWithNonPrimaryColumns[0].code).to.be.equal(1);
            expect(loadedPost!.categoriesWithNonPrimaryColumns[0].version).to.be.equal(1);
            expect(loadedPost!.categoriesWithNonPrimaryColumns[0].description).to.be.equal("category of cars");

        })));

        it("should load related entity when both entities have multiple primary columns and JoinTable used without options", () => Promise.all(connections.map(async connection => {

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "BMW";
            category2.type = "cars-category";
            category2.code = 2;
            category2.version = 1;
            await connection.manager.persist(category2);

            const category3 = new Category();
            category3.name = "airplanes";
            category3.type = "common-category";
            category3.code = 3;
            category3.version = 1;
            await connection.manager.persist(category3);

            const tag1 = new Tag();
            tag1.code = 1;
            tag1.title = "About BMW";
            tag1.description = "Tag about BMW";
            tag1.categories = [category1, category2];
            await connection.manager.persist(tag1);

            const tag2 = new Tag();
            tag2.code = 2;
            tag2.title = "About Boeing";
            tag2.description = "tag about Boeing";
            tag2.categories = [category3];
            await connection.manager.persist(tag2);

            const loadedTags = await connection.manager
                .createQueryBuilder(Tag, "tag")
                .leftJoinAndSelect("tag.categories", "categories")
                .orderBy("tag.code, categories.code")
                .getMany();

            expect(loadedTags[0].categories).to.not.be.empty;
            expect(loadedTags[0].categories[0].name).to.be.equal("cars");
            expect(loadedTags[0].categories[0].type).to.be.equal("common-category");
            expect(loadedTags[0].categories[1].name).to.be.equal("BMW");
            expect(loadedTags[0].categories[1].type).to.be.equal("cars-category");
            expect(loadedTags[1].categories).to.not.be.empty;
            expect(loadedTags[1].categories[0].name).to.be.equal("airplanes");
            expect(loadedTags[1].categories[0].type).to.be.equal("common-category");

            const loadedTag = await connection.manager
                .createQueryBuilder(Tag, "tag")
                .leftJoinAndSelect("tag.categories", "categories")
                .orderBy("categories.code")
                .where("tag.code = :code", { code: 1 })
                .getOne();

            expect(loadedTag!.categories).to.not.be.empty;
            expect(loadedTag!.categories[0].name).to.be.equal("cars");
            expect(loadedTag!.categories[0].type).to.be.equal("common-category");

        })));

        it("should load related entity when both entities have multiple primary columns and JoinTable used with options", () => Promise.all(connections.map(async connection => {

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "BMW";
            category2.type = "cars-category";
            category2.code = 2;
            category2.version = 1;
            await connection.manager.persist(category2);

            const category3 = new Category();
            category3.name = "airplanes";
            category3.type = "common-category";
            category3.code = 3;
            category3.version = 1;
            await connection.manager.persist(category3);

            const tag1 = new Tag();
            tag1.code = 1;
            tag1.title = "About BMW";
            tag1.description = "Tag about BMW";
            tag1.categoriesWithOptions = [category1, category2];
            await connection.manager.persist(tag1);

            const tag2 = new Tag();
            tag2.code = 2;
            tag2.title = "About Boeing";
            tag2.description = "Tag about Boeing";
            tag2.categoriesWithOptions = [category3];
            await connection.manager.persist(tag2);

            const loadedTags = await connection.manager
                .createQueryBuilder(Tag, "tag")
                .leftJoinAndSelect("tag.categoriesWithOptions", "categories")
                .orderBy("tag.code, categories.code")
                .getMany();

            expect(loadedTags[0].categoriesWithOptions).to.not.be.empty;
            expect(loadedTags[0].categoriesWithOptions[0].name).to.be.equal("cars");
            expect(loadedTags[0].categoriesWithOptions[0].type).to.be.equal("common-category");
            expect(loadedTags[0].categoriesWithOptions[1].name).to.be.equal("BMW");
            expect(loadedTags[0].categoriesWithOptions[1].type).to.be.equal("cars-category");
            expect(loadedTags[1].categoriesWithOptions).to.not.be.empty;
            expect(loadedTags[1].categoriesWithOptions[0].name).to.be.equal("airplanes");
            expect(loadedTags[1].categoriesWithOptions[0].type).to.be.equal("common-category");

            const loadedTag = await connection.manager
                .createQueryBuilder(Tag, "tag")
                .leftJoinAndSelect("tag.categoriesWithOptions", "categories")
                .orderBy("categories.code")
                .where("tag.code = :code", { code: 1 })
                .getOne();

            expect(loadedTag!.categoriesWithOptions).to.not.be.empty;
            expect(loadedTag!.categoriesWithOptions[0].name).to.be.equal("cars");
            expect(loadedTag!.categoriesWithOptions[0].type).to.be.equal("common-category");

        })));

        it("should load related entity when both entities have multiple primary columns and JoinTable references with non-primary columns", () => Promise.all(connections.map(async connection => {

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            category1.description = "category of cars";
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "BMW";
            category2.type = "cars-category";
            category2.code = 2;
            category2.version = 1;
            category2.description = "category of BMW";
            await connection.manager.persist(category2);

            const category3 = new Category();
            category3.name = "airplanes";
            category3.type = "common-category";
            category3.code = 3;
            category3.version = 1;
            category3.description = "category of airplanes";
            await connection.manager.persist(category3);

            const tag1 = new Tag();
            tag1.code = 1;
            tag1.title = "About BMW";
            tag1.description = "Tag about BMW";
            tag1.categoriesWithNonPrimaryColumns = [category1, category2];
            await connection.manager.persist(tag1);

            const tag2 = new Tag();
            tag2.code = 2;
            tag2.title = "About Boeing";
            tag2.description = "Tag about Boeing";
            tag2.categoriesWithNonPrimaryColumns = [category3];
            await connection.manager.persist(tag2);

            const loadedTags = await connection.manager
                .createQueryBuilder(Tag, "tag")
                .leftJoinAndSelect("tag.categoriesWithNonPrimaryColumns", "categories")
                .orderBy("tag.code, categories.code")
                .getMany();

            expect(loadedTags[0].categoriesWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedTags[0].categoriesWithNonPrimaryColumns[0].code).to.be.equal(1);
            expect(loadedTags[0].categoriesWithNonPrimaryColumns[0].version).to.be.equal(1);
            expect(loadedTags[0].categoriesWithNonPrimaryColumns[0].description).to.be.equal("category of cars");
            expect(loadedTags[0].categoriesWithNonPrimaryColumns[1].code).to.be.equal(2);
            expect(loadedTags[0].categoriesWithNonPrimaryColumns[1].version).to.be.equal(1);
            expect(loadedTags[0].categoriesWithNonPrimaryColumns[1].description).to.be.equal("category of BMW");
            expect(loadedTags[1].categoriesWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedTags[1].categoriesWithNonPrimaryColumns[0].code).to.be.equal(3);
            expect(loadedTags[1].categoriesWithNonPrimaryColumns[0].version).to.be.equal(1);
            expect(loadedTags[1].categoriesWithNonPrimaryColumns[0].description).to.be.equal("category of airplanes");

            const loadedTag = await connection.manager
                .createQueryBuilder(Tag, "tag")
                .leftJoinAndSelect("tag.categoriesWithNonPrimaryColumns", "categories")
                .orderBy("categories.code")
                .where("tag.code = :code", { code: 1 })
                .getOne();

            expect(loadedTag!.categoriesWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedTag!.categoriesWithNonPrimaryColumns[0].code).to.be.equal(1);
            expect(loadedTag!.categoriesWithNonPrimaryColumns[0].version).to.be.equal(1);
            expect(loadedTag!.categoriesWithNonPrimaryColumns[0].description).to.be.equal("category of cars");

        })));

    });

    describe("inverse side", () => {

        it("should load related entity when JoinTable used without options", () => Promise.all(connections.map(async connection => {

            const post1 = new Post();
            post1.title = "About BMW";
            await connection.manager.persist(post1);

            const post2 = new Post();
            post2.title = "About Audi";
            await connection.manager.persist(post2);

            const post3 = new Post();
            post3.title = "About Boeing";
            await connection.manager.persist(post3);

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            category1.posts = [post1, post2];
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "airplanes";
            category2.type = "common-category";
            category2.code = 2;
            category2.version = 1;
            category2.posts = [post3];
            await connection.manager.persist(category2);

            const loadedCategories = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.posts", "posts")
                .orderBy("category.code, posts.id")
                .getMany();

            expect(loadedCategories[0].posts).to.not.be.empty;
            expect(loadedCategories[0].posts[0].id).to.be.equal(1);
            expect(loadedCategories[0].posts[1].id).to.be.equal(2);
            expect(loadedCategories[1].posts).to.not.be.empty;
            expect(loadedCategories[1].posts[0].id).to.be.equal(3);

            const loadedCategory = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.posts", "posts")
                .orderBy("posts.id")
                .where("category.code = :code", { code: 1 })
                .getOne();

            expect(loadedCategory!.posts).to.not.be.empty;
            expect(loadedCategory!.posts[0].id).to.be.equal(1);
            expect(loadedCategory!.posts[1].id).to.be.equal(2);

        })));

        it("should load related entity when JoinTable used with options", () => Promise.all(connections.map(async connection => {

            const post1 = new Post();
            post1.title = "About BMW";
            await connection.manager.persist(post1);

            const post2 = new Post();
            post2.title = "About Audi";
            await connection.manager.persist(post2);

            const post3 = new Post();
            post3.title = "About Boeing";
            await connection.manager.persist(post3);

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            category1.postsWithOptions = [post1, post2];
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "airplanes";
            category2.type = "common-category";
            category2.code = 2;
            category2.version = 1;
            category2.postsWithOptions = [post3];
            await connection.manager.persist(category2);

            const loadedCategories = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.postsWithOptions", "posts")
                .orderBy("category.code, posts.id")
                .getMany();

            expect(loadedCategories[0].postsWithOptions).to.not.be.empty;
            expect(loadedCategories[0].postsWithOptions[0].id).to.be.equal(1);
            expect(loadedCategories[0].postsWithOptions[1].id).to.be.equal(2);
            expect(loadedCategories[1].postsWithOptions).to.not.be.empty;
            expect(loadedCategories[1].postsWithOptions[0].id).to.be.equal(3);

            const loadedCategory = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.postsWithOptions", "posts")
                .orderBy("posts.id")
                .where("category.code = :code", { code: 1 })
                .getOne();

            expect(loadedCategory!.postsWithOptions).to.not.be.empty;
            expect(loadedCategory!.postsWithOptions[0].id).to.be.equal(1);
            expect(loadedCategory!.postsWithOptions[1].id).to.be.equal(2);

        })));

        it("should load related entity when JoinTable references with non-primary columns", () => Promise.all(connections.map(async connection => {

            const post1 = new Post();
            post1.title = "About BMW";
            await connection.manager.persist(post1);

            const post2 = new Post();
            post2.title = "About Audi";
            await connection.manager.persist(post2);

            const post3 = new Post();
            post3.title = "About Boeing";
            await connection.manager.persist(post3);

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            category1.description = "category of cars";
            category1.postsWithNonPrimaryColumns = [post1, post2];
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "airplanes";
            category2.type = "common-category";
            category2.code = 2;
            category2.version = 1;
            category2.description = "category of airplanes";
            category2.postsWithNonPrimaryColumns = [post3];
            await connection.manager.persist(category2);

            const loadedCategories = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.postsWithNonPrimaryColumns", "posts")
                .orderBy("category.code, posts.id")
                .getMany();

            expect(loadedCategories[0].postsWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedCategories[0].postsWithNonPrimaryColumns[0].id).to.be.equal(1);
            expect(loadedCategories[0].postsWithNonPrimaryColumns[1].id).to.be.equal(2);
            expect(loadedCategories[1].postsWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedCategories[1].postsWithNonPrimaryColumns[0].id).to.be.equal(3);

            const loadedCategory = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.postsWithNonPrimaryColumns", "posts")
                .orderBy("posts.id")
                .where("category.code = :code", { code: 1 })
                .getOne();

            expect(loadedCategory!.postsWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedCategory!.postsWithNonPrimaryColumns[0].id).to.be.equal(1);
            expect(loadedCategory!.postsWithNonPrimaryColumns[1].id).to.be.equal(2);

        })));

        it("should load related entity when both entities have multiple primary columns and JoinTable used without options", () => Promise.all(connections.map(async connection => {

            const tag1 = new Tag();
            tag1.code = 1;
            tag1.title = "About BMW";
            tag1.description = "Tag about BMW";
            await connection.manager.persist(tag1);

            const tag2 = new Tag();
            tag2.code = 2;
            tag2.title = "About Audi";
            tag2.description = "Tag about Audi";
            await connection.manager.persist(tag2);

            const tag3 = new Tag();
            tag3.code = 3;
            tag3.title = "About Boeing";
            tag3.description = "tag about Boeing";
            await connection.manager.persist(tag3);

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            category1.tags = [tag1, tag2];
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "airplanes";
            category2.type = "common-category";
            category2.code = 2;
            category2.version = 1;
            category2.tags = [tag3];
            await connection.manager.persist(category2);

            const loadedCategories = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.tags", "tags")
                .orderBy("category.code, tags.code")
                .getMany();

            expect(loadedCategories[0].tags).to.not.be.empty;
            expect(loadedCategories[0].tags[0].title).to.be.equal("About BMW");
            expect(loadedCategories[0].tags[0].description).to.be.equal("Tag about BMW");
            expect(loadedCategories[0].tags[1].title).to.be.equal("About Audi");
            expect(loadedCategories[0].tags[1].description).to.be.equal("Tag about Audi");
            expect(loadedCategories[1].tags).to.not.be.empty;
            expect(loadedCategories[1].tags[0].title).to.be.equal("About Boeing");
            expect(loadedCategories[1].tags[0].description).to.be.equal("tag about Boeing");

            const loadedCategory = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.tags", "tags")
                .orderBy("tags.code")
                .where("category.code = :code", { code: 1 })
                .getOne();

            expect(loadedCategory!.tags).to.not.be.empty;
            expect(loadedCategory!.tags[0].title).to.be.equal("About BMW");
            expect(loadedCategory!.tags[0].description).to.be.equal("Tag about BMW");

        })));

        it("should load related entity when both entities have multiple primary columns and JoinTable used with options", () => Promise.all(connections.map(async connection => {

            const tag1 = new Tag();
            tag1.code = 1;
            tag1.title = "About BMW";
            tag1.description = "Tag about BMW";
            await connection.manager.persist(tag1);

            const tag2 = new Tag();
            tag2.code = 2;
            tag2.title = "About Audi";
            tag2.description = "Tag about Audi";
            await connection.manager.persist(tag2);

            const tag3 = new Tag();
            tag3.code = 3;
            tag3.title = "About Boeing";
            tag3.description = "tag about Boeing";
            await connection.manager.persist(tag3);

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            category1.tagsWithOptions = [tag1, tag2];
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "airplanes";
            category2.type = "common-category";
            category2.code = 2;
            category2.version = 1;
            category2.tagsWithOptions = [tag3];
            await connection.manager.persist(category2);

            const loadedCategories = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.tagsWithOptions", "tags")
                .orderBy("category.code, tags.code")
                .getMany();

            expect(loadedCategories[0].tagsWithOptions).to.not.be.empty;
            expect(loadedCategories[0].tagsWithOptions[0].title).to.be.equal("About BMW");
            expect(loadedCategories[0].tagsWithOptions[0].description).to.be.equal("Tag about BMW");
            expect(loadedCategories[0].tagsWithOptions[1].title).to.be.equal("About Audi");
            expect(loadedCategories[0].tagsWithOptions[1].description).to.be.equal("Tag about Audi");
            expect(loadedCategories[1].tagsWithOptions).to.not.be.empty;
            expect(loadedCategories[1].tagsWithOptions[0].title).to.be.equal("About Boeing");
            expect(loadedCategories[1].tagsWithOptions[0].description).to.be.equal("tag about Boeing");

            const loadedCategory = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.tagsWithOptions", "tags")
                .orderBy("tags.code")
                .where("category.code = :code", { code: 1 })
                .getOne();

            expect(loadedCategory!.tagsWithOptions).to.not.be.empty;
            expect(loadedCategory!.tagsWithOptions[0].title).to.be.equal("About BMW");
            expect(loadedCategory!.tagsWithOptions[0].description).to.be.equal("Tag about BMW");

        })));

        it("should load related entity when both entities have multiple primary columns and JoinTable references with non-primary columns", () => Promise.all(connections.map(async connection => {

            const tag1 = new Tag();
            tag1.code = 1;
            tag1.title = "About BMW";
            tag1.description = "Tag about BMW";
            await connection.manager.persist(tag1);

            const tag2 = new Tag();
            tag2.code = 2;
            tag2.title = "About Audi";
            tag2.description = "Tag about Audi";
            await connection.manager.persist(tag2);

            const tag3 = new Tag();
            tag3.code = 3;
            tag3.title = "About Boeing";
            tag3.description = "tag about Boeing";
            await connection.manager.persist(tag3);

            const category1 = new Category();
            category1.name = "cars";
            category1.type = "common-category";
            category1.code = 1;
            category1.version = 1;
            category1.description = "category of cars";
            category1.tagsWithNonPrimaryColumns = [tag1, tag2];
            await connection.manager.persist(category1);

            const category2 = new Category();
            category2.name = "airplanes";
            category2.type = "common-category";
            category2.code = 2;
            category2.version = 1;
            category2.description = "category of airplanes";
            category2.tagsWithNonPrimaryColumns = [tag3];
            await connection.manager.persist(category2);

            const loadedCategories = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.tagsWithNonPrimaryColumns", "tags")
                .orderBy("category.code, tags.code")
                .getMany();

            expect(loadedCategories[0].tagsWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedCategories[0].tagsWithNonPrimaryColumns[0].title).to.be.equal("About BMW");
            expect(loadedCategories[0].tagsWithNonPrimaryColumns[0].description).to.be.equal("Tag about BMW");
            expect(loadedCategories[0].tagsWithNonPrimaryColumns[1].title).to.be.equal("About Audi");
            expect(loadedCategories[0].tagsWithNonPrimaryColumns[1].description).to.be.equal("Tag about Audi");
            expect(loadedCategories[1].tagsWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedCategories[1].tagsWithNonPrimaryColumns[0].title).to.be.equal("About Boeing");
            expect(loadedCategories[1].tagsWithNonPrimaryColumns[0].description).to.be.equal("tag about Boeing");

            const loadedCategory = await connection.manager
                .createQueryBuilder(Category, "category")
                .leftJoinAndSelect("category.tagsWithNonPrimaryColumns", "tags")
                .orderBy("tags.code")
                .where("category.code = :code", { code: 1 })
                .getOne();

            expect(loadedCategory!.tagsWithNonPrimaryColumns).to.not.be.empty;
            expect(loadedCategory!.tagsWithNonPrimaryColumns[0].title).to.be.equal("About BMW");
            expect(loadedCategory!.tagsWithNonPrimaryColumns[0].description).to.be.equal("Tag about BMW");

        })));

    });

});