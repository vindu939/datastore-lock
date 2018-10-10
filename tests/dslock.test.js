const Datastore = require("@google-cloud/datastore");
const chai = require("chai");
const expect = chai.expect;

//export DATASTORE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS to run the tests

const DSLock = require("../src/dslock");
const dsClient = new Datastore();

describe("dslock", function () {

    describe("one client, within lease time", function () {
        this.timeout(60000);
        let dslock;

        this.beforeAll(function () {
            dslock = new DSLock({ dsClient });
        });

        it("should be able to acquire the lock attempted first time", function () {
            return dslock.lock()
                .then(locked => expect(locked).to.be.true);
        });

        it("should NOT be able to acquire the lock when attempted more than once WITHOUT unlocking", function () {
            return dslock.lock()
                .then(locked => expect(locked).to.be.false);
        });

        it("should be able to unlock the acquired lock", function () {
            return dslock.unlock()
                .then(unlocked => expect(unlocked).to.be.true);
        });

        it("should be able to reacquire the lock after unlocking", function () {
            return dslock.lock()
                .then(locked => expect(locked).to.be.true)
                .then(() => dslock.unlock())
                .then(unlocked => expect(unlocked).to.be.true)
                .then(() => dslock.lock())
                .then(locked => expect(locked).to.be.true);
        });

        this.afterAll(function () {
            return dslock.unlock();
        });
    });

    describe("one client, lock lease expiration", function () {
        this.timeout(60000);
        let dslock;

        this.beforeEach(function () {
            dslock = new DSLock({
                dsClient,
                leaseFor: 3
            });
        });

        it("should NOT be able to reacquire the lock unless lease time has expired", function () {
            return dslock.lock()
                .then(locked => expect(locked).to.be.true)
                .then(() => new Promise((resolve, reject) => {
                    setTimeout(() => resolve(), 1000);
                }))
                .then(() => dslock.lock())
                .then(locked => expect(locked).to.be.false);
        });

        it("should be able to reacquire the lock after lease time has expired", function () {
            return dslock.lock()
                .then(locked => expect(locked).to.be.true)
                .then(() => new Promise((resolve, reject) => {
                    setTimeout(() => resolve(), 3500);
                }))
                .then(() => dslock.lock())
                .then(locked => expect(locked).to.be.true);
        });

        this.afterEach(function () {
            return dslock.unlock();
        });
    });

    describe("multiple clients, withing leased time", function () {

        it("only one should be able to get the lock", function () {
            let locks = [new DSLock({ dsClient }), new DSLock({ dsClient })];

            return Promise.all(locks.map(l => l.lock()))
                .then((_locks) => {
                    expect(_locks[0]).to.not.equal(_locks[1]);
                    return _locks;
                })
                .then(_locks => {
                    let toUnlock = locks.find((l, i) => _locks[i]);
                    return toUnlock && toUnlock.unlock();
                });
        });

        it("one should NOT be able to unlock another client's lock", function () {
            let lock1 = new DSLock({ dsClient }),
                lock2 = new DSLock({ dsClient });

            return lock1.lock()
                .then(locked1 => expect(locked1).to.be.true)
                .then(() => lock2.unlock())
                .then(unlocked => expect(unlocked).to.be.false)
                .then(() => lock1.unlock())
                .then(unlocked => expect(unlocked).to.be.true);
        });
    });

    describe("multiple clients, when lease expired", function () {
        it("another client should be able to aquire the lock once lease time has expired", function () {
            this.timeout(60000);
            let lock1 = new DSLock({ dsClient, leaseFor: 2 }),
                lock2 = new DSLock({ dsClient });

            return lock1.lock()
                .then(locked1 => expect(locked1).to.be.true)
                .then(() => new Promise((resolve, reject) => {
                    setTimeout(() => resolve(), 2500);
                }))
                .then(() => lock2.lock())
                .then(locked2 => expect(locked2).to.be.true)
                .then(() => lock2.unlock())
                .then(unlocked => expect(unlocked).to.be.true);
        });
    });

});
