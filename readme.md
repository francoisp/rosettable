## Rationale for myPgTriggers

Wouldn't it be nice if we were over C19? Ok well in the mean time here's a hack that you might like (and a [song](https://www.youtube.com/watch?v=lD4sxxoJGkA) to cheer you up while you read this): 

Postgres is the awesomest RDBMS out there, with some really cool stuff baked in --stored procedures in many languages, triggers, JSON-native, pubsub like pg_notify etc...(last with postgraphile/GraphQL is simply sublime). 

Yet a lot of great open-source software developers have chosen mysql/mariadb/mongodb over it in the past. Personal choices cannot be discussed. So to contribute to these nice software projects (mailtrain, matomo, etc) you have to do the LAMP dance... That might turn you off, social distancing and all. Not so fast! Postgres allows you to interact both read and write with the data in these datastores (and more!) as if they were in postgres using Foreign Data Wrappers: FDW for the world!

There's one thing, though. If you are a postgres aficionado, you most likely love triggers. Say you connect to a foreign mysql schema in postgres:

```
CREATE USER MAPPING FOR yourpguser SERVER mysql_server OPTIONS (username 'mysqluser', password 'mysqlpass');
create schema mysql_msqldatabase;
IMPORT FOREIGN SCHEMA msqldatabase FROM SERVER mysql_server INTO mysql_msqldatabase;
```

You can define triggers on your IMPORTed FOREIGN SCHEMA. Nice! So say you add a trigger to a foreign data table named employee. When you UPDATE a row in employee via a postgres connection, your trigger will get called. Yay! But what if a table is modified via an app that has a connection to the mysqld, not to your shinny new postgres FDW?

No triggers for you...	😢

This is where this hack comes in!!! 👍	😛

Using mysql's binlog(thru a cool evt reader call zongji) and a few schema queries this node app will fire your postgres triggers for you! (well not really, it repackages and executes your triggers' code post-commit) You can run this as a deamon using pm2 and for example get pg_notifies when data changes in mysql.  

But you ask, what if I modified the NEW row in the before trigger? Or set it to NULL to prevent the operation? Well that works too! The post-before value of NEW is compared with the pre-value and silent UPDATES are issued. There's a 20% chance of bugs, please report.

## Caveat

This app adds an optional column named pgrti on the fly to any mysql for which you add a trigger in postgres. This means that if you have inserts that do not specify the columns in your MySQL schema you'll need to edit some statements like this:

```
INSERT INTO employee VALUES (DEFAULT, 'MYSQLINSERT--',2);
```
needs to change to:
```
INSERT INTO employee(emp_id,emp_name,emp_dept_id) VALUES (DEFAULT, 'MYSQLINSERT--',2);
```
## How to test/use

0. This requires a small bugfix that has not made it yet to the MySQL FDW distribution. Please get it here: https://github.com/francoisp/mysql_fdw

```
--follow instructions to make and install the updated myslq_fdw -- for now --. Hopefully the PR will merge upstream soon
```

1. Enable MySQL binlog in my.cnf, restart MySQL server after making these changes.
```
# Must be unique integer from 1-2^32
server-id        = 1
# Row format required for ZongJi, the very nice binlog parser used
binlog_format    = row
# Directory must exist. This path works for Linux. Other OS may require
#   different path.
log_bin          = /var/log/mysql/mysql-bin.log

binlog_do_db     = employees   # Optional, limit which databases to log
expire_logs_days = 10          # Optional, purge old logs
max_binlog_size  = 100M        # Optional, limit log size
```

2. clone this repo and get depenecencies:
```
npm -i
```
5. run all test (testing assumes mysql>=5.7 and postgres>=11 running on localhost for simplicity, look at mypgstriggers.js for the connection strings) This creates a database and mapping and some tests triggers and runs some tests. 
``` 
bash ./setupandtest.sh --mysqlrootpass $mysqlrootpass --postgresport $postgresport --postgresuser $PGUSERWITHSUPER --postgrespass  $PGUSERPASS
```

Please let me know if this is useful, cheerio, stay safe.:	[🌈]( https://www.youtube.com/watch?v=zsk6z9O1WmE)

PS: I'm releasing this under the GPL. If your commercial project could use this, let me know. We can do a support contract and/or a special license.

PPS: Same if you'd like to see a version for MongoDB, Oracle, MSSQL etc, please get in touch we'll work something out.
