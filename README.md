## datastore-lock
A lightweight implementation of the distributed lock which is based on [Google Datastore](https://cloud.google.com/datastore/).

### Where to use?
Mainly useful for the application level distributed locks. 

Example Scenario: you have a an application which sends an email based on an external event. If your application is running multiple instances of it and external event triggers an action in all the instances, you might be required to use distributed locks to ensure that NOT all instances end up sending the email and only one mail is being sent.

### What does it offer?
It allows an application to acquire lock for a leased period of time (by default 1 minute, but can be configured using `options`) which will prevent other application instance who complete for it from acquiring the lock, till the first application either releases the lock or leased time gets expired.

### How to use?

1. Download via npm `npm install datastore-lock`.
2. Instantiate
``` js
const dslock = new DSLock(options);
```
3. acquire lock 

``` js
dslock.lock()
    .then(locked => {
        if(locked){
            // lock acquired, do something exclusively
        } else{
            // failed to acquire the lock, not safe to run exclusive logic
        }
    });
```
4. release the lock once done
``` js
dslock.unlock()
    .then(unlocked => {
        if(unlocked){
            // lock released
        } else{
            // could not release the lock
        }
    });
```

### Options

while instantiation you can pass options to configure the datastore-lock

``` js
const dslock = new DSLock(options)
```

`options` object can have following values:

- `projectId` - (required if `dsClient` is not set) google project id which will be used to connect to Google Datastore
- `leaseFor` - (optional) max number of seconds the lock would be available for, after this time runs out and lock is not released, it will automatically get expired. Default value is 60.
- `dsClient` - (required if `projectId` is not set) an instance of Datastore client as described [here](https://cloud.google.com/nodejs/docs/reference/datastore/1.4.x/).
- `keyFilename` - (optional) file path of the Google service account credentials, alternatively you can set `GOOGLE_APPLICATION_CREDENTIALS` env variable.
- `lockKeyName` - (optional) name of the key which will be used while creating the lock in the Datastore. Useful in cases where you want more than one locks in the same application for different functionalities. Default value if *lockKeyName*.
- `namespace` - (optional) Google Datastore namespace to create and store the lock. Default value is *dslock*.