const crypto = require("crypto");
const debug = require("debug")("dslock");
const Datastore = require("@google-cloud/datastore");

const NAMESPACE = "dslock",
    LOCK = "lock",
    DEFAULT_LEASE_TIME = 60;

let lockKeyName = "ds-lock-key";


const _getLock = Symbol("getLock"),
    _addLock = Symbol("addLock");

class DSLock {

    constructor(options) {
        if (!options.projectId && !options.dsClient) {
            throw new Error("please provide 'projectId' or 'dsClient'");
        }

        lockKeyName = options.lockKeyName || lockKeyName;

        this.projectId = options.projectId;
        this.namespace = options.namespace || NAMESPACE;
        this.keyFilename = options.keyFilename;
        this.leaseFor = options.leaseFor || DEFAULT_LEASE_TIME;

        if (options.dsClient) {
            this.dsClient = options.dsClient;
        } else {
            let self = this;
            const dsOptions = {
                projectId: self.projectId,
                namespace: self.namespace
            };

            if (this.keyFilename) {
                dsOptions["keyFilename"] = this.keyFilename;
            } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                dsOptions["keyFilename"] = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            }

            this.dsClient = new Datastore(dsOptions);
        }


        this.clientId = (() => {
            let _clientId;
            return () => {
                if (_clientId) {
                    return Promise.resolve(_clientId);
                }

                return new Promise((resolve, reject) => {
                    crypto.randomBytes(16, (err, buf) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        _clientId = buf.toString("hex");
                        resolve(_clientId);
                    });
                });
            };
        })();

        this.lockKey = this.dsClient.key([LOCK, lockKeyName]);
    }

    [_getLock](tran) {
        return tran.get(this.lockKey)
            .then(res => res[0]);
    }

    [_addLock](tran) {
        return this.clientId()
            .then(clientId => {
                let expiresAt = new Date();
                expiresAt.setSeconds(expiresAt.getSeconds() + this.leaseFor);

                return tran.save({
                    key: this.lockKey,
                    data: {
                        clientId,
                        expiresAt
                    }
                });
            });
    }

    lock() {
        const transaction = this.dsClient.transaction();
        let acquired = false;
        return transaction.run()
            .then(() => this[_getLock](transaction))
            .then(l => {
                let now = new Date();
                if (!l || (now > l.expiresAt)) {
                    return this[_addLock](transaction);
                }

                return Promise.reject("couldn't get the lock");
            })
            .then(() => {
                return transaction.commit();
            })
            .then(() => {
                acquired = true;
                debug("lock acquired", acquired);
            })
            .catch(err => {
                acquired = false;
                debug("error acquiring the lock", err);
                return transaction.rollback();
            })
            .then(() => acquired);
    }

    unlock() {
        const transaction = this.dsClient.transaction();
        let clientId;
        let removed = false;
        return transaction.run()
            .then(() => this.clientId())
            .then(cid => (clientId = cid))
            .then(() => this[_getLock](transaction))
            .then(l => {
                if (l.clientId === clientId) {
                    return transaction.delete(this.lockKey);
                }

                return Promise.reject("not an owner");
            })
            .then(() => {
                return transaction.commit();
            })
            .then(() => {
                removed = true;
                debug("lock released", removed);
            })
            .catch(err => {
                removed = false;
                debug("error removing the lock", err);
                return transaction.rollback();
            })
            .then(() => removed);
    }
}

module.exports = DSLock;
