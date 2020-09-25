#!/bin/bash

#run all unit tests on linux, you can do each steps individually on other OSes

echo "setupandtest.sh with args: $*"
echo "setupandtest.sh: we are assuming postgres and mysql are local, and that binlog has been enabled in my.cnf and mysql has been restarted"
# origArgs=$*
postgresport=5432
if ! options=$(getopt -u -o r:d -l mysqlrootpass:,postgresport:,postgresuser:,postgrespass: -- "$@")
then
    # something went wrong, getopt will put out an error message for us
    exit 1
fi



set -- $options

while [ $# -gt 0 ]
do
    case $1 in
    # for options with required arguments, an additional shift is required 
    -r|--mysqlrootpass ) mysqlrootpass=$2; shift;;
	-p|--postgresport ) postgresport=$2; shift;;
	-U|--postgresuser ) postgresuser=$2; shift;;
	-P|--postgrespass ) postgrespass=$2; shift;;
	#-d|--ctScriptPath ) ctScriptPath=$2; shift;;

    #(-*) echo "$0: error - unrecognized option $1" 1>&2; exit 1;;
    (*) break;;
    esac
    shift
done


args="$*"
# make sure our deamon is not running
pkill -f 'node rosettable'
while [ $? -eq 0 ]; do  
	echo "deamon was running: wait for it to be dead"
	sleep 1;
	pkill -f 'node rosettable'
done
sleep 1;

#ifnot download
if [ -z "$mysqlrootpass" ]; then 
	echo "the mysql root pass is required to create the test database";
	exit 1;
fi

echo 'SETUP:creating our test database in mysql'
mysqlargs="-u root -p$mysqlrootpass";
mysql $mysqlargs < setuptest_mysql_create_test_schema.sql


echo 'SETUP:creating our test database in postgres, our test user, our mapping and some triggers'
# this assumes we are running this script as root
#su postgres -c "psql -p 5433 -f setuptest_pg_import_fdw_create_triggers.sql"
#if that is not an option replace by where supuser has superuser rights
PGPASSWORD=$postgrespass psql -h localhost -p $postgresport -U $postgresuser -f setuptest_pg_import_fdw_create_triggers.sql 


#start our binlog watching node process
node rosettable.js > watcher1.log & triggerwatcherpid=$!
echo "STARTED OUR WATCHING DEAMON: triggerwatcherpid: $triggerwatcherpid"
# lets wait 2 seconds for it to be ready
sleep 2

echo 'run mysql test'
mysql $mysqlargs < runtests_mysql.sql


echo 'run pg tests'
PGPASSWORD=this_1s_fdw_us3r psql -h localhost -p $postgresport -U fdw_user -d testdb_pg -f runtests_pg.sql > testres_mysql_then_pg.out

if [ ! -f testexp_mysql_then_pg ]; then
	echo 'ERROR: missing testexp_mysql_then_pg cannot validate tests';
	exit 1;
fi
testres=$(diff testres_mysql_then_pg.out testexp_mysql_then_pg );
if [ "$testres" != "" ]; then
	echo "AT LEAST ONE PG TEST FAIED!"
	sleep 1
	kill "$triggerwatcherpid"
	echo "$testres"
	exit 1;
else
	echo "All mysql then pg tests succeded"
fi

echo "now run with first edit in PG"
sleep 1
kill "$triggerwatcherpid"
sleep 2



echo 'SETUP:creating our test database in mysql'
mysqlargs="-u root -p$mysqlrootpass";
mysql $mysqlargs < setuptest_mysql_create_test_schema.sql


echo 'SETUP:creating our test database in postgres, our test user, our mapping and some triggers'
# this assumes we are running this script as root
#su postgres -c "psql -p 5433 -f setuptest_pg_import_fdw_create_triggers.sql"
#if that is not an option replace by where supuser has superuser rights
PGPASSWORD=$postgrespass psql -h localhost -p $postgresport -U $postgresuser -f setuptest_pg_import_fdw_create_triggers.sql 


#start our binlog watching node process
node rosettable.js > watcher2.log & triggerwatcherpid=$!
echo "STARTED OUR WATCHING DEAMON: triggerwatcherpid: $triggerwatcherpid"
# lets wait 2 seconds for it to be ready
sleep 2

echo 'run pg tests'
PGPASSWORD=this_1s_fdw_us3r psql -h localhost -p $postgresport -U fdw_user -d testdb_pg -f runtests_pg.sql

echo 'run mysql test'
mysql $mysqlargs < runtests_mysql.sql

PGPASSWORD=this_1s_fdw_us3r psql -h localhost -p $postgresport -U fdw_user -d testdb_pg  -c 'select emp_id,emp_name,emp_dept_id,trigg_count from fs_mqltestdb.employee;' > testres_pg_then_mysql.out


if [ ! -f testexp_pg_then_mysql ]; then
	echo 'ERROR: missing testexp_pg_then_mysql cannot validate tests';
	exit 1;
fi

testres=$(diff testres_pg_then_mysql.out testexp_pg_then_mysql   );
if [ "$testres" != "" ]; then
	echo "AT LEAST ONE PG TEST FAIED!"
	echo "$testres"
	sleep 1
	kill "$triggerwatcherpid"
	exit 1;
else
	echo "All mysql then pg tests succeded"
fi

cat testres_pg_then_mysql.out

echo "ALL TESTS PASSED"
sleep 1
kill "$triggerwatcherpid"

