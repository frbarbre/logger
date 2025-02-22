migrate(
  (db) => {
    const collections = [
      {
        id: "stats_realtime",
        name: "stats_realtime",
        resolution: "10s",
      },
      {
        id: "stats_10m",
        name: "stats_10m",
        resolution: "10m",
      },
      {
        id: "stats_15m",
        name: "stats_15m",
        resolution: "15m",
      },
      {
        id: "stats_30m",
        name: "stats_30m",
        resolution: "30m",
      },
      {
        id: "stats_1h",
        name: "stats_1h",
        resolution: "1h",
      },
      {
        id: "stats_3h",
        name: "stats_3h",
        resolution: "3h",
      },
      {
        id: "stats_6h",
        name: "stats_6h",
        resolution: "6h",
      },
      {
        id: "stats_9h",
        name: "stats_9h",
        resolution: "9h",
      },
      {
        id: "stats_12h",
        name: "stats_12h",
        resolution: "12h",
      },
    ];

    for (let config of collections) {
      const collection = new Collection({
        id: config.id,
        name: config.name,
        type: "base",
        system: false,
        options: {
          manageRule: "locked",
        },
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
        indexes: [
          `CREATE INDEX idx_${config.name}_timestamp ON ${config.name} (timestamp)`,
        ],
        schema: [
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
          {
            id: "field_containers",
            name: "containers",
            type: "json",
            required: true,
            options: {},
          },
          {
            id: "field_metadata",
            name: "metadata",
            type: "json",
            required: false,
            options: {},
          },
        ],
      });

      db.save(collection);
    }

    return db;
  },
  (db) => {
    // Revert all collections in reverse order
    const collections = [
      "stats_12h",
      "stats_9h",
      "stats_6h",
      "stats_3h",
      "stats_1h",
      "stats_30m",
      "stats_15m",
      "stats_10m",
      "stats_realtime",
    ];

    for (let id of collections) {
      const collection = db.findCollectionByNameOrId(id);
      if (collection) {
        db.deleteCollection(collection.id);
      }
    }

    return db;
  }
);
