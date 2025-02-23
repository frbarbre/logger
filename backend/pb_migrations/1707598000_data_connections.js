migrate(
  (app) => {
    console.log("Creating data_connection collection");
    const collection = new Collection({
      name: "data_connection",
      type: "base",
      options: {
        manageRule: "locked",
      },
      fields: [
        {
          type: "text",
          name: "platform",
          required: true,
        },
        {
          type: "json",
          name: "auth_credentials",
          required: true,
        },
        {
          type: "date",
          name: "created_at",
          required: true,
        },
        {
          type: "date",
          name: "updated_at",
          required: true,
        },
      ],
    });

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("data_connection");
    if (collection) {
      app.delete(collection);
    }
  }
);
