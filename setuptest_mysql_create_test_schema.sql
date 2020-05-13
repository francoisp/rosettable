
-- this is the user our binlog watching deamon connects to mysql with; 
-- we are granting this role replication rights to all tables
DROP USER IF EXISTS 'pgtriggersd'@'localhost';
CREATE USER 'pgtriggersd'@'localhost' IDENTIFIED BY 'pointandshoot';
GRANT REPLICATION SLAVE, REPLICATION CLIENT, SELECT ON *.* TO 'pgtriggersd'@'localhost';
FLUSH PRIVILEGES;

-- this role is used by our deamon to alter the schema to add a col on first use, and to revert changes when before triggers in pg would mandate 
DROP USER IF EXISTS 'pgtriggerscl'@'localhost';
CREATE USER 'pgtriggerscl'@'localhost' IDENTIFIED BY 'pointandshoot2';
GRANT SELECT, UPDATE, INSERT, DELETE, ALTER ON *.* TO 'pgtriggerscl'@'localhost';
FLUSH PRIVILEGES;

-- create a test database 
DROP DATABASE IF EXISTS mqltestdb;
CREATE DATABASE mqltestdb;
USE mqltestdb;
-- our tables
create table employee(emp_id int NOT NULL AUTO_INCREMENT PRIMARY KEY, emp_name text, emp_dept_id int, trigg_count int);
-- populate with some fake data
-- NB: this is the type of insert that will need a slight modification if presnt in other mysql clients:
-- because this binlog watching trigger deamen adds a new col  
INSERT INTO employee VALUES(DEFAULT, 'emp - 1', 1,NULL);
INSERT INTO employee VALUES(DEFAULT, 'emp - 2', 1,NULL);
INSERT INTO employee VALUES(DEFAULT, 'emp - 3', 1,NULL);
INSERT INTO employee VALUES(DEFAULT, 'emp - 4', 2,NULL);
INSERT INTO employee VALUES(DEFAULT, 'emp - 5', 2,NULL);
INSERT INTO employee VALUES(DEFAULT, 'emp - 6', 2,NULL);

-- create a user for our postgres FDW. 
DROP USER IF EXISTS 'clientpg'@'localhost';
CREATE USER 'clientpg'@'localhost' IDENTIFIED BY 'fdwfordeworld';
GRANT  ALL PRIVILEGES ON mqltestdb.* TO 'clientpg'@'localhost';
FLUSH PRIVILEGES;

select 'ATTENTION for binlog watching to work you need to enable MySQL binlog in my.cnf ans restart MySQL: see https://github.com/nevill/zongji' as '';
select 'Here is a sample:' as '';
select '[mysqld]' as '';
select '# Must be unique integer from 1-2^32' as '';
select 'server-id = 1' as '';
select '# Row format required for ZongJi' as '';
select 'binlog_format    = row' as '';
select '# Directory must exist. This path works for Linux. Other OS may require a different path' as '';
select 'log_bin          = /var/log/mysql/mysql-bin.log' as '';
select 'expire_logs_days = 10          # Optional, purge old logs' as '';
select 'max_binlog_size  = 100M        # Optional, limit log size' as '';
select 'binlog_do_db     = mqltestdb   # Optional?, limit which databases to log' as '';