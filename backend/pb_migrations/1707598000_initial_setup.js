migrate(
  (db) => {
    console.log("Creating superuser");
    // Create superuser
    const admin = new Record(db.findCollectionByNameOrId("_superusers"));
    admin.set("email", process.env.POCKETBASE_ADMIN_EMAIL);
    admin.set("password", process.env.POCKETBASE_ADMIN_PASSWORD);
    db.save(admin);

    console.log("Creating container_stats collection");
    // Create container_stats collection
    const collection = new Collection({
      id: "container_stats",
      name: "container_stats",
      type: "base",
      system: false,
      options: {
        manageRule: "locked",
      },
      indexes: [],
      fields: [
        {
          id: "field_name",
          name: "name",
          type: "text",
          required: true,
          options: {},
        },
        {
          id: "field_cpu",
          name: "cpu_percent",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_mem_usage",
          name: "memory_usage",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_mem_limit",
          name: "memory_limit",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_mem_percent",
          name: "memory_percent",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_net_in",
          name: "net_io_in",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_net_out",
          name: "net_io_out",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_block_in",
          name: "block_io_in",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_block_out",
          name: "block_io_out",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_pids",
          name: "pids",
          type: "number",
          required: false,
          options: {},
        },
        {
          id: "field_timestamp",
          name: "timestamp",
          type: "date",
          required: true,
          options: {
            min: "",
            max: "",
          },
        },
      ],
    });

    return db.save(collection);
  },
  (db) => {
    // Revert changes
    console.log("Reverting changes");
    const collection = db.findCollectionByNameOrId("container_stats");
    if (collection) {
      db.deleteCollection(collection.id);
    }
  }
);
