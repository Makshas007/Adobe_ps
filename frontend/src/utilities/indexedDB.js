let imgDbPromise = null;
let histDbPromise = null;

function getImgDB() {
    if (!imgDbPromise) {
        imgDbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open("Images", 1);
            request.onerror = (e) => reject(new Error("Database error: " + e.target.errorCode));
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("images")) {
                    db.createObjectStore("images", { keyPath: "id" });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
        });
    }
    return imgDbPromise;
}

function getHistoryDB() {
    if (!histDbPromise) {
        histDbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open("History", 1);
            request.onerror = (e) => reject(new Error("Database error: " + e.target.errorCode));
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("nodes")) {
                    db.createObjectStore("nodes", { keyPath: "id" });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
        });
    }
    return histDbPromise;
}

const buildNodeTree = async (head) => {
    const head_arr = await history.getHeads();
    if (!head && !head_arr.includes(head)) return null;

    const node = await history.getNode(head);
    if (!node || node.prevNode != null) return null;

    const childIds = Array.isArray(node.nextNode) ? node.nextNode : [];
    const children = [];

    for (const childId of childIds) {
        const childTree = await _buildNodeTreeHelper(childId);
        if (childTree) {
            children.push(childTree);
        }
    }

    return { ...node, children };
};

const _buildNodeTreeHelper = async (nodeId) => {
    const node = await history.getNode(nodeId);
    if (!node) return null;

    const childIds = Array.isArray(node.nextNode) ? node.nextNode : [];
    const children = [];

    for (const childId of childIds) {
        const childTree = await _buildNodeTreeHelper(childId);
        if (childTree) {
            children.push(childTree);
        }
    }

    return { ...node, children };
}

const tree = async (head) => buildNodeTree(head);

const image = {
    addImage: async (blob) => {
        const db = await getImgDB();
        return new Promise((resolve, reject) => {
            let id = crypto.randomUUID();
            const transaction = db.transaction(["images"], "readwrite");
            const store = transaction.objectStore("images");
            const request = store.put({ id, blob });

            request.onerror = () => reject(new Error("Failed to add image"));
            request.onsuccess = () => resolve({ id });
        });
    },

    getImage: async (id) => {
        const db = await getImgDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["images"], "readonly");
            const store = transaction.objectStore("images");
            const request = store.get(id);

            request.onerror = () => reject(new Error(`Failed to retrieve image with id: ${id}`));
            request.onsuccess = () => resolve(request.result?.blob || null);
        });
    },

    deleteImage: async (id) => {
        const db = await getImgDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["images"], "readwrite");
            const store = transaction.objectStore("images");
            const request = store.delete(id);

            request.onerror = () => reject(new Error(`Failed to delete image with id: ${id}`));
            request.onsuccess = () => resolve(true);
        });
    },

    getAllImages: async () => {
        const db = await getImgDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["images"], "readonly");
            const store = transaction.objectStore("images");
            const request = store.getAll();

            request.onerror = () => reject(new Error("Failed to retrieve images"));
            request.onsuccess = () => resolve(request.result);
        });
    }
}

const history = {
    addNode: async (nodeData, prevNode = null) => {
        const db = await getHistoryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["nodes"], "readwrite");
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

    getNode: async (id) => {
        const db = await getHistoryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["nodes"], "readonly");
            const store = transaction.objectStore("nodes");
            const request = store.get(id);

            request.onerror = () => reject(new Error(`Failed to retrieve node with id: ${id}`));
            request.onsuccess = () => resolve(request.result || null);
        });
    },

    getHeads: async () => {
        const db = await getHistoryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["nodes"], "readonly");
            const store = transaction.objectStore("nodes");
            const request = store.getAll();

            request.onerror = () => reject(new Error("Failed to retrieve heads"));
            request.onsuccess = () => {
                const heads = request.result.filter(node => !node.prevNode);
                resolve(heads);
            };
        });
    },

    getTree: async (id) => {
        return buildNodeTree(id);
    },
}

export { image, history }