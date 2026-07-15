let Imgdb, HistoryDB;

const request1 = indexedDB.open("Images", 1);
request1.onerror = event => console.error("Database error: " + event.target.errorCode);
request1.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
    }
};
request1.onsuccess = event => { Imgdb = event.target.result; };

const request2 = indexedDB.open("History", 2);
request2.onerror = event => console.error("Database error: " + event.target.errorCode);
request2.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains("nodes")) {
        db.createObjectStore("nodes", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("messages")) {
        db.createObjectStore("messages", { keyPath: "id" });
    }
};
request2.onsuccess = event => { HistoryDB = event.target.result; };

const buildNodeTree = async (head) => {
    if (!head) return null;
    const node = await history.getNode(head);
    if (!node) return null;

    const childIds = Array.isArray(node.nextNode) ? node.nextNode : [];
    const children = [];

    for (const childId of childIds) {
        const childTree = await buildNodeTree(childId);
        if (childTree) {
            children.push(childTree);
        }
    }

    return { ...node, children };
};

const image = {
    addImage: (blob) => {
        return new Promise((resolve, reject) => {
            if (!Imgdb) return reject(new Error("Database not initialized"));
            let id = crypto.randomUUID?.() ?? `${Date.now()}_${Math.random()}`;
            const transaction = Imgdb.transaction(["images"], "readwrite");
            const store = transaction.objectStore("images");
            const request = store.put({ id, blob });

            request.onerror = () => reject(new Error("Failed to add image"));
            request.onsuccess = () => resolve({ id });
        });
    },

    getImage: (id) => {
        return new Promise((resolve, reject) => {
            if (!id) return resolve(null); // Guard clause against undefined keys
            if (!Imgdb) return reject(new Error("Database not initialized"));

            const transaction = Imgdb.transaction(["images"], "readonly");
            const store = transaction.objectStore("images");
            // FIXED: Passing raw id directly instead of IDBKeyRange.only({id})
            const request = store.get(id);

            request.onerror = () => reject(new Error(`Failed to retrieve image with id: ${id}`));
            request.onsuccess = () => resolve(request.result?.blob || null);
        });
    },

    deleteImage: (id) => {
        return new Promise((resolve, reject) => {
            if (!id) return reject(new Error("No ID provided"));
            if (!Imgdb) return reject(new Error("Database not initialized"));

            const transaction = Imgdb.transaction(["images"], "readwrite");
            const store = transaction.objectStore("images");
            // FIXED: Passing raw id directly instead of IDBKeyRange.only({id})
            const request = store.delete(id);

            request.onerror = () => reject(new Error(`Failed to delete image with id: ${id}`));
            request.onsuccess = () => resolve(true);
        });
    },

    getAllImages: () => {
        return new Promise((resolve, reject) => {
            if (!Imgdb) return reject(new Error("Database not initialized"));
            const transaction = Imgdb.transaction(["images"], "readonly");
            const store = transaction.objectStore("images");
            const request = store.getAll();

            request.onerror = () => reject(new Error("Failed to retrieve images"));
            request.onsuccess = () => resolve(request.result);
        });
    }
};

const history = {
    addNode: (nodeData, prevNode = null) => {
        return new Promise((resolve, reject) => {
            if (!HistoryDB) return reject(new Error("Database not initialized"));
            const transaction = HistoryDB.transaction(["nodes"], "readwrite");
            const store = transaction.objectStore("nodes");
            const newNodeId = crypto.randomUUID?.() ?? `${Date.now()}`;
            const newNode = { id: newNodeId, ...nodeData, prevNode, nextNode: [] };
            const request = store.put(newNode);

            request.onerror = () => reject(new Error("Failed to add node"));
            request.onsuccess = () => {
                if (!prevNode) {
                    resolve(newNode);
                    return;
                }

                // FIXED: Passing raw key variable directly
                const prevRequest = store.get(prevNode);
                prevRequest.onerror = () => reject(new Error("Failed to update previous node"));
                prevRequest.onsuccess = () => {
                    const previousNode = prevRequest.result;
                    if (!previousNode) {
                        resolve(newNode);
                        return;
                    }

                    const nextNode = Array.isArray(previousNode.nextNode) ? previousNode.nextNode : [];
                    if (!nextNode.includes(newNodeId)) {
                        nextNode.push(newNodeId);
                    }

                    const updateRequest = store.put({ ...previousNode, nextNode });
                    updateRequest.onerror = () => reject(new Error("Failed to update previous node"));
                    updateRequest.onsuccess = () => resolve(newNode);
                };
            };
        });
    },

    getNode: (id) => {
        return new Promise((resolve, reject) => {
            if (!id) return resolve(null); // Guard clause against undefined keys
            if (!HistoryDB) return reject(new Error("Database not initialized"));

            const transaction = HistoryDB.transaction(["nodes"], "readonly");
            const store = transaction.objectStore("nodes");
            // FIXED: Passing raw id directly instead of IDBKeyRange.only({id})
            const request = store.get(id);

            request.onerror = () => reject(new Error(`Failed to retrieve node with id: ${id}`));
            request.onsuccess = () => resolve(request.result || null);
        });
    },

    getHeads: () => {
        return new Promise((resolve, reject) => {
            if (!HistoryDB) return reject(new Error("Database not initialized"));
            const transaction = HistoryDB.transaction(["nodes"], "readonly");
            const store = transaction.objectStore("nodes");
            const request = store.getAll();

            request.onerror = () => reject(new Error("Failed to retrieve heads"));
            request.onsuccess = () => {
                const heads = request.result.filter(node => !node.prevNode);
                resolve(heads);
            };
        });
    },

    getTree: (id) => {
        return new Promise((resolve, reject) => {
            buildNodeTree(id).then(resolve).catch(reject);
        });
    },

    getAllNodes: () => {
        return new Promise((resolve, reject) => {
            if (!HistoryDB) return reject(new Error("Database not initialized"));
            const transaction = HistoryDB.transaction(["nodes"], "readonly");
            const store = transaction.objectStore("nodes");
            const request = store.getAll();

            request.onerror = () => reject(new Error("Failed to retrieve nodes"));
            request.onsuccess = () => resolve(request.result);
        });
    },

    delete: (id) => {
        return new Promise(async (resolve, reject) => {
            if (!id) return reject(new Error("No ID provided"));
            if (!HistoryDB) return reject(new Error("Database not initialized"));

            try {
                const node = await history.getNode(id);
                if (!node) return resolve();

                const transaction = HistoryDB.transaction(["nodes"], "readwrite");
                const store = transaction.objectStore("nodes");
                const request = store.delete(id);

                request.onerror = () => reject(new Error('Could not delete node #' + id));
                request.onsuccess = async () => {
                    if (node.imageId) {
                        try {
                            await image.deleteImage(node.imageId);
                        } catch (err) {
                            console.warn(`Failed to delete associated image ${node.imageId}:`, err);
                        }
                    }
                    if (node.nextNode && node.nextNode.length) {
                        try {
                            await Promise.all(node.nextNode.map(async nextId => await history.delete(nextId)));
                        } catch (err) {
                            return reject(err);
                        }
                    }
                    resolve();
                };
            } catch (err) {
                reject(err);
            }
        });
    }

};

const messages = {
    save: (headId, msgs, timestamp) => {
        return new Promise((resolve, reject) => {
            if (!headId) return reject(new Error("No headId provided"));
            if (!HistoryDB) return reject(new Error("Database not initialized"));
            const transaction = HistoryDB.transaction(["messages"], "readwrite");
            const store = transaction.objectStore("messages");
            const request = store.put({ id: headId, messages: msgs, timestamp: timestamp || Date.now() });
            request.onerror = () => reject(new Error("Failed to save messages"));
            request.onsuccess = () => resolve();
        });
    },

    get: (headId) => {
        return new Promise((resolve, reject) => {
            if (!headId) return resolve(null);
            if (!HistoryDB) return reject(new Error("Database not initialized"));
            const transaction = HistoryDB.transaction(["messages"], "readonly");
            const store = transaction.objectStore("messages");
            const request = store.get(headId);
            request.onerror = () => reject(new Error("Failed to get messages"));
            request.onsuccess = () => resolve(request.result || null);
        });
    },

    delete: (headId) => {
        return new Promise((resolve, reject) => {
            if (!headId) return reject(new Error("No headId provided"));
            if (!HistoryDB) return reject(new Error("Database not initialized"));
            const transaction = HistoryDB.transaction(["messages"], "readwrite");
            const store = transaction.objectStore("messages");
            const request = store.delete(headId);
            request.onerror = () => reject(new Error("Failed to delete messages"));
            request.onsuccess = () => resolve();
        });
    }
};

const waitForDB = () => {
    return new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if ((Imgdb && HistoryDB) || attempts > 20) {
                clearInterval(interval);
                resolve();
            }
        }, 50);
    });
};

export { image, history, messages, waitForDB };