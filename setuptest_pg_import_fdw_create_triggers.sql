select version();
DROP DATABASE testdb_pg;


DROP USER IF EXISTS fdw_user;
-- this user is used both to own our mapping and by the deamon to list and run the triggers
CREATE USER fdw_user WITH ENCRYPTED PASSWORD 'this_1s_fdw_us3r';
CREATE USER fdw_user2 WITH ENCRYPTED PASSWORD 'this_1s_fdw_us3r';
-- we need UTF8
CREATE DATABASE testdb_pg WITH ENCODING 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE template0 OWNER fdw_user;
GRANT ALL ON testdb_pg to fdw_user2;
-- connect to our new DB
\c testdb_pg;
--SHOW SERVER_ENCODING;

select 'ATTENTION this project requires a bugfix to the MYSQL_FDW that as of this writting has not been merged: you can get the fork here and compile:https://github.com/francoisp/mysql_fdw';--select mysql_fdw_version();
CREATE EXTENSION mysql_fdw; --  this needs to run as superuser, at this point we are still the user that started this script which should have all rights
select mysql_fdw_version(); -- we did not update the official version yet, but when it is we should check we are running the version with the required fix

-- we are assuming mysql and pg are on the same machine YMMV
CREATE SERVER mysql_server FOREIGN DATA WRAPPER mysql_fdw OPTIONS (host '127.0.0.1', port '3306');
GRANT ALL PRIVILEGES ON FOREIGN SERVER mysql_server TO fdw_user;
set role fdw_user;




GRANT ALL PRIVILEGES ON DATABASE testdb_pg TO fdw_user;


-- register our foreign data wrapper mapping, basically a serverside client connection
CREATE USER MAPPING FOR fdw_user SERVER mysql_server OPTIONS (username 'clientpg', password 'fdwfordeworld');
select 'create a schema where we''ll map the foreign tables';
create schema fs_mqltestdb;

-- this cresates the mapping tables
IMPORT FOREIGN SCHEMA mqltestdb FROM SERVER mysql_server INTO fs_mqltestdb;
select 'we could have the same mysql db mapped at different locations, we need to support this';
create schema fs_mqltestdb2;
IMPORT FOREIGN SCHEMA mqltestdb FROM SERVER mysql_server INTO fs_mqltestdb2;


select 'create some test triggers and procedures';
CREATE OR REPLACE FUNCTION testinstrig() returns trigger
AS $$
DECLARE
BEGIN
NEW.emp_name = NEW.emp_name || ' insert trigger mod!';

-- we will verify that the trigger is not fired twice
IF NEW.trigg_count is NULL OR NEW.trigg_count = 0  THEN 
	NEW.trigg_count = 1;
 ELSE 
 	NEW.trigg_count = NEW.trigg_count + 1;
 END IF;

-- test revert with this
IF NEW.emp_id = 42 THEN
	return NULL;
END IF;

return NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER testinstrig BEFORE INSERT ON fs_mqltestdb.employee FOR EACH ROW EXECUTE PROCEDURE testinstrig();

CREATE OR REPLACE FUNCTION testuptrig() returns trigger
AS $$
DECLARE
BEGIN

-- we will verify that the trigger is not fired twice
IF NEW.trigg_count is NULL OR NEW.trigg_count = 0  THEN 
	NEW.trigg_count = 1;
 ELSE 
 	NEW.trigg_count = NEW.trigg_count + 1;
 END IF;

NEW.emp_name = NEW.emp_name || ' TRIGGER UPDATED!';
	
-- test revert with this
IF NEW.emp_id = 4 THEN
	return NULL;
END IF;

return NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER testupstrig BEFORE UPDATE ON fs_mqltestdb.employee FOR EACH ROW EXECUTE PROCEDURE testuptrig();


CREATE OR REPLACE FUNCTION testdeltrig() returns trigger
AS $$
DECLARE
BEGIN

-- test revert with this
IF OLD.emp_id = 4 THEN
	return NULL;
END IF;

return OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER testdeltrig BEFORE DELETE ON fs_mqltestdb.employee FOR EACH ROW EXECUTE PROCEDURE testdeltrig();


-- create a trigger with notices
CREATE OR REPLACE FUNCTION raise_a_notice() RETURNS TRIGGER AS
$$
DECLARE
    arg TEXT;
BEGIN
 	RAISE NOTICE 'oh but why args here? count: ''%''?',TG_NARGS;

    FOREACH arg IN ARRAY TG_ARGV LOOP
        RAISE NOTICE 'Why would you pass in ''%''?',arg;
    END LOOP;
    RETURN NEW; -- in plpgsql you must return OLD, NEW, or another record of table's type
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER no_inserts_without_notices BEFORE INSERT ON fs_mqltestdb.employee FOR EACH ROW EXECUTE PROCEDURE raise_a_notice('spoiled fish','stunned parrots');

--select * from information_schema.triggers;
