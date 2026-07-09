let Imgdb, HistoryDB;
const request1 = indexedDB.open("Images", 1);

request1.onerror = event => {
    console.error("Database error: " + event.target.errorCode);
};
request1.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
    }
};
request1.onsuccess = event => {
    Imgdb = event.target.result;
};

const request2 = indexedDB.open("History", 1);

request2.onerror = event => {
    console.error("Database error: " + event.target.errorCode);
};
request2.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains("nodes")) {
        db.createObjectStore("nodes", { keyPath: "id" });
    }
};
request2.onsuccess = event => {
    HistoryDB = event.target.result;
};

const buildNodeTree = async (head) => {
    const node = await history.getNode(head);
    if (!node || node?.nextNode.length == 0) return null;

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

const tree = async (head) => buildNodeTree(head);

const image = {
    addImage: (blob) => {
        return new Promise((resolve, reject) => {
            let id = crypto.randomUUID();
            const transaction = Imgdb.transaction(["images"], "readwrite");
            const store = transaction.objectStore("images");
            const request = store.put({ id, blob });

            request.onerror = () => reject(new Error("Failed to add image"));
            request.onsuccess = () => resolve({ id });
        });
    },

    getImage: (id) => {
        return new Promise((resolve, reject) => {
            const transaction = Imgdb.transaction(["images"], "readonly");
            const store = transaction.objectStore("images");
            const request = store.get(IDBKeyRange.only({id}));

            request.onerror = () => reject(new Error(`Failed to retrieve image with id: ${id}`));
            request.onsuccess = () => resolve(request.result?.blob || null);
        });
    },

    deleteImage: (id) => {
        return new Promise((resolve, reject) => {
            const transaction = Imgdb.transaction(["images"], "readwrite");
            const store = transaction.objectStore("images");
            const request = store.delete(IDBKeyRange.only({id}));

            request.onerror = () => reject(new Error(`Failed to delete image with id: ${id}`));
            request.onsuccess = () => resolve(true);
        });
    },

    getAllImages: () => {
        return new Promise((resolve, reject) => {
            const transaction = Imgdb.transaction(["images"], "readonly");
            const store = transaction.objectStore("images");
            const request = store.getAll();

            request.onerror = () => reject(new Error("Failed to retrieve images"));
            request.onsuccess = () => resolve(request.result);
        });
    }
}
const history = {
    addNode: (nodeData, prevNode = null) => {
        return new Promise((resolve, reject) => {
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

                const prevRequest = store.get(IDBKeyRange.only(prevNode));
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
            const transaction = HistoryDB.transaction(["nodes"], "readonly");
            const store = transaction.objectStore("nodes");
            const request = store.get(IDBKeyRange.only({id}));

            request.onerror = () => reject(new Error(`Failed to retrieve node with id: ${id}`));
            request.onsuccess = () => resolve(request.result || null);
        });
    },
    getHeads: () => {
        return new Promise((resolve, reject) => {
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

}


export { image, history }