let Imgdb, HistoryDB;
let request = indexedDB.open("Images", 1);

request.onerror = event => {
    console.error("Database error: " + event.target.errorCode);
};
request.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
    }
};
request.onsuccess = event => {
    Imgdb = event.target.result;
};

request = indexedDB.open("History", 1);

request.onerror = event => {
    console.error("Database error: " + event.target.errorCode);
};
request.onupgradeneeded = event => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains("nodes")) {
        db.createObjectStore("nodes", { keyPath: "id" });
    }
};
request.onsuccess = event => {
    HistoryDB = event.target.result;
};

const buildNodeTree = async (head) => {
    const head_arr = await exports.history.getHeads()
    if (!head && !head_arr.includes(head)) return null;

    const node = await exports.history.getNode(head);
    if (!node || node?.previousNode != null) return null;

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

const exports = {
    image: {
        addImage: (id, blob) => {
            return new Promise((resolve, reject) => {
                const transaction = Imgdb.transaction(["images"], "readwrite");
                const store = transaction.objectStore("images");
                const request = store.put({ id, blob });

                request.onerror = () => reject(new Error("Failed to add image"));
                request.onsuccess = () => resolve({ id, blob });
            });
        },

        getImage: (id) => {
            return new Promise((resolve, reject) => {
                const transaction = Imgdb.transaction(["images"], "readonly");
                const store = transaction.objectStore("images");
                const request = store.get(id);

                request.onerror = () => reject(new Error(`Failed to retrieve image with id: ${id}`));
                request.onsuccess = () => resolve(request.result?.blob || null);
            });
        },

        deleteImage: (id) => {
            return new Promise((resolve, reject) => {
                const transaction = Imgdb.transaction(["images"], "readwrite");
                const store = transaction.objectStore("images");
                const request = store.delete(id);

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
    },
    history: {
        addNode: (nodeData, prevNode = null) => {
            return new Promise((resolve, reject) => {
                const transaction = HistoryDB.transaction(["nodes"], "readwrite");
                const store = transaction.objectStore("nodes");
                const newNodeId = nodeData?.id ?? crypto.randomUUID?.() ?? `${Date.now()}`;
                const newNode = { id: newNodeId, ...nodeData, prevNode, nextNode: [] };
                const request = store.put(newNode);

                request.onerror = () => reject(new Error("Failed to add node"));
                request.onsuccess = () => {
                    if (!prevNode) {
                        resolve(newNode);
                        return;
                    }

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
                const transaction = HistoryDB.transaction(["nodes"], "readonly");
                const store = transaction.objectStore("nodes");
                const request = store.get(id);

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
}

export default exports