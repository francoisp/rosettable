\c mailtrain_pg;
select version();

--alter foreign table  mysql_mailtrain.users drop pgrti;
-- SET session_replication_role = replica;

-- DROP SCHEMA mysql_mailtrain cascade;
-- CREATE SCHEMA mysql_mailtrain;

-- DROP FOREIGN TABLE mysql_mailtrain.users;
IMPORT FOREIGN SCHEMA mailtrain LIMIT TO(employee) FROM SERVER mysql_server INTO mysql_mailtrain;
--ALTER FOREIGN TABLE mysql_mailtrain.employee DROP COLUMN pgrti;
-- --ALTER FOREIGN TABLE mysql_mailtrain.users ADD COLUMN pgrti int DEFAULT NULL;
--ALTER FOREIGN TABLE mysql_mailtrain.users ADD COLUMN pgrti int DEFAULT NULL;

-- CREATE OR REPLACE FUNCTION aaatrig_upins_pgrti() returns trigger
-- AS $$
-- DECLARE
-- BEGIN
-- 	-- this check is in case this trggier gets called before the pgrti col is added. May happen on database restore for example
-- 	IF NOT(row_to_json(NEW)->'pgrti' is NULL) THEN
-- 		NEW.pgrti = 2000000000*random();
-- 	END IF;
-- 	--RAISE LOG 'aaatrig_upins_pgrti';
--   RAISE NOTICE 'aaatrig_upins_pgrti %', row_to_json(NEW)::text;
--   return NEW;

-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE OR REPLACE FUNCTION aaatrig_del_pgrti() returns trigger
-- AS $$
-- DECLARE
-- trigrow json; 
-- whereClause text DEFAULT 'WHERE ';
-- key text;
-- value text; 
-- BEGIN
-- 	trigrow = row_to_json(OLD);
-- 	-- build a where clause to match exactly our row
-- 	FOR key, value in select * from json_each_text(trigrow) LOOP
-- 		whereClause = whereClause || key || ' = ''' || value || ''' AND '; 
-- 	END LOOP;
-- 	whereClause = regexp_replace(whereClause, 'AND\s$', '');
-- 	-- this check is in case this trggier gets called before the pgrti col is added. May happen on database restore for example
-- 	IF NOT(trigrow->'pgrti' is NULL) THEN
-- 		--we wrap the next statement with session_replication_role to prevent firing the triggers in pg
-- 		SET session_replication_role = replica;
-- 		 -- this is sentinel value, by setting this value we ignore the update in mysql, we tag this as a pg delete. 
-- 		--this is a bit of a hack
-- 		EXECUTE('UPDATE '||TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME||' set pgrti = -42424242 ' || whereClause || ';');
-- 		SET session_replication_role = DEFAULT;
-- 	END IF;
-- 	--RAISE LOG 'aaatrig_del_pgrti';
-- 	--RAISE NOTICE 'aaatrig_del_pgrti %', row_to_json(OLD)::text;
--   return OLD;

-- END;
-- $$ LANGUAGE plpgsql;
-- DROP TRIGGER IF EXISTS aaatrigins_employee_pgrti ON mysql_mailtrain.employee;
-- DROP TRIGGER IF EXISTS aaatrigup_employee_pgrti ON mysql_mailtrain.employee;

-- CREATE TRIGGER aaatrigup_employee_pgrti BEFORE UPDATE ON mysql_mailtrain.employee FOR EACH ROW EXECUTE PROCEDURE aaatrig_upins_pgrti();
-- CREATE TRIGGER aaatrigins_employee_pgrti BEFORE INSERT ON mysql_mailtrain.employee FOR EACH ROW EXECUTE PROCEDURE aaatrig_upins_pgrti();
-- CREATE TRIGGER aaatrigdel_employee_pgrti BEFORE DELETE ON mysql_mailtrain.employee FOR EACH ROW EXECUTE PROCEDURE aaatrig_del_pgrti();
--DROP TRIGGER aarigger_up_pgrti ON mysql_mailtrain.users;


CREATE OR REPLACE FUNCTION testinstrig() returns trigger
AS $$
DECLARE
BEGIN
NEW.emp_name = NEW.emp_name || 'trigger mod!';
IF NEW.emp_id = 316 THEN
	return NULL;
END IF;
return NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER testinstrig BEFORE INSERT ON mysql_mailtrain.employee FOR EACH ROW EXECUTE PROCEDURE testinstrig();

CREATE OR REPLACE FUNCTION testuptrig() returns trigger
AS $$
DECLARE
BEGIN

NEW.emp_name = NEW.emp_name || 'UPDATE!';
	
IF NEW.emp_id = 319 THEN
	return NULL;
END IF;

return NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER testupstrig BEFORE UPDATE ON mysql_mailtrain.employee FOR EACH ROW EXECUTE PROCEDURE testuptrig();


CREATE OR REPLACE FUNCTION testdeltrig() returns trigger
AS $$
DECLARE
BEGIN

IF OLD.emp_id = 319 THEN
	return NULL;
END IF;
return OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER testdeltrig BEFORE DELETE ON mysql_mailtrain.employee FOR EACH ROW EXECUTE PROCEDURE testdeltrig();



CREATE OR REPLACE FUNCTION raise_a_notice() RETURNS TRIGGER AS
$$
DECLARE
    arg TEXT;
BEGIN
 	RAISE NOTICE 'but why args here? count: ''%''?',TG_NARGS;

    FOREACH arg IN ARRAY TG_ARGV LOOP
        RAISE NOTICE 'Why would you pass in ''%''?',arg;
    END LOOP;
    RETURN NEW; -- in plpgsql you must return OLD, NEW, or another record of table's type
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER no_inserts_without_notices BEFORE INSERT ON mysql_mailtrain.employee FOR EACH ROW EXECUTE PROCEDURE raise_a_notice('spoiled fish','stunned parrots');
--CREATE TRIGGER testinstrig BEFORE INSERT ON mysql_mailtrain.users FOR EACH ROW EXECUTE PROCEDURE testinstrig();

--update mysql_mailtrain.users set pgrti=234 where id = 1;	
--update mysql_mailtrain.users set email = 'admin1@example.com' where id = 1;
insert into mysql_mailtrain.employee values(default,'alice',2);

update mysql_mailtrain.employee set emp_name = 'bob' where emp_id = 1;
update mysql_mailtrain.employee set emp_name = 'bobby' where emp_id = 1;


--delete from mysql_mailtrain.employee where emp_dept_id = 2;
select * from 	mysql_mailtrain.employee;
--select pgrti from mysql_mailtrain.users where id = 1;	
-- SET session_replication_role = DEFAULT;

-- SET session_replication_role = replica;
-- delete from mysql_mailtrain.triggertest where email = 'mysqlTESTINSERT@email.com';	
-- SET session_replication_role = DEFAULT;





--select * from information_schema.triggers;

--select * from pg_proc where proname = 'aaatrig_upins_pgrti';

--select prosrc,regexp_replace(prosrc, '([\s|;])--[^\n]*', '\1', 'ig') from pg_proc where proname = 'raise_a_notice';

--select prosrc,regexp_replace(regexp_replace(prosrc, '([\s|;])--[^\n]*', '\1', 'g'), '([\s|;])RETURN(\s)+[^;]+;', '\1', 'ig') from pg_proc where proname = 'raise_a_notice';
select * from information_schema.triggers;





create function pg_temp.mysqltrigbefore36286053(NEW RECORD) returns  jsonb 
AS $$
	DECLARE
	BEGIN

	-- body of each trigger in order
	
DECLARE
OLD RECORD DEFAULT NULL;
TG_NAME name DEFAULT 'testinstrig';
TG_WHEN text DEFAULT 'BEFORE';
TG_LEVEL text DEFAULT 'ROW';
TG_OP text DEFAULT 'INSERT';
TG_RELNAME name DEFAULT 'employee';
TG_TABLE_NAME name DEFAULT 'employee';
TG_TABLE_SCHEMA name DEFAULT 'mysql_mailtrain';
TG_NARGS integer DEFAULT 0;
TG_ARGV TEXT[] DEFAULT  ARRAY[]::TEXT[];
BEGIN
NEW.emp_name = NEW.emp_name || 'trigger mod!';
NEW = NEW;
END;

DECLARE
OLD RECORD DEFAULT NULL;
TG_NAME name DEFAULT 'no_inserts_without_notices';
TG_WHEN text DEFAULT 'BEFORE';
TG_LEVEL text DEFAULT 'ROW';
TG_OP text DEFAULT 'INSERT';
TG_RELNAME name DEFAULT 'employee';
TG_TABLE_NAME name DEFAULT 'employee';
TG_TABLE_SCHEMA name DEFAULT 'mysql_mailtrain';
TG_NARGS integer DEFAULT 2;
TG_ARGV TEXT[] DEFAULT ARRAY['spoiled fish', 'stunned parrots'];
    arg TEXT;
BEGIN
 	RAISE NOTICE 'but why args here? count: ''%''?',TG_NARGS;

    FOREACH arg IN ARRAY TG_ARGV LOOP
        RAISE NOTICE 'Why would you pass in ''%''?',arg;
    END LOOP;
     
END;
return row_to_json(NEW);

END;
$$ LANGUAGE plpgsql;
select pg_temp.mysqltrigbefore36286053(evtro) from (    SELECT 245 as emp_id,'al' as emp_name,2 as emp_dept_id,null as pgrti) as evtro;




-- DO $$  
-- 		<<wrap_trigger_block>> 
-- DECLARE 
--  NEW RECORD;			
-- BEGIN 
--  SELECT 64 as emp_id,'alicetrigger mod!' as emp_name,2 as emp_dept_id,null as pgrti into NEW;
-- DECLARE
    
-- BEGIN


--  NEW.emp_name = NEW.emp_name || 'trigger mod!';
--  --RAISE NOTICE 'NEW:%', NEW;
-- return;
-- END;
--  RAISE NOTICE 'NEW:%', NEW;
-- END wrap_trigger_block $$;



--select * from information_schema.triggers where event_manipulation = 'INSERT' AND event_object_schema = 'mysql_mailtrain' AND event_object_table = 'triggertest' AND action_orientation = 'ROW';
--select trim(trailing '()' from regexp_replace(action_statement, 'EXECUTE PROCEDURE\s+', '')) from information_schema.triggers where event_manipulation = 'INSERT' AND event_object_schema = 'mysql_mailtrain' AND event_object_table = 'triggertest' AND action_orientation = 'ROW' ORDER BY action_order,action_timing;
--select trim(trailing '()' from regexp_replace(action_statement, 'EXECUTE PROCEDURE\s+', '')) from information_schema.triggers where event_manipulation = 'UPDATE' AND event_object_schema = 'mysql_mailtrain' AND event_object_table = 'users' AND action_orientation = 'ROW' ORDER BY action_order,action_timing;
-- format the plpgsql code to replace return
--SELECT regexp_replace(prosrc, '(\s|\t)(R|r)(E|e)(T|t)(U|u)(R|r)(N|n)(\s|\t)+[^;]+;', 'return;', 'g') FROM pg_proc WHERE proname = 'testtrigger_change';


--select regexp_replace(prosrc, '(\s|\t)(R|r)(E|e)(T|t)(U|u)(R|r)(N|n)(\s|\t)+[^;]+;', 'return;', 'g') as procs from information_schema.triggers,pg_proc where information_schema.triggers.event_manipulation = 'UPDATE' AND information_schema.triggers.event_object_schema = 'mysql_mailtrain' AND information_schema.triggers.event_object_table = 'users' AND information_schema.triggers.action_orientation = 'ROW' AND pg_proc.proname = trim(trailing '()' from regexp_replace(action_statement, 'EXECUTE PROCEDURE\s+', '')) ORDER BY information_schema.triggers.action_order,information_schema.triggers.action_timing;


--select * from testtrigger_insert();

--insert into mysql_mailtrain.triggertest values(DEFAULT,'mysqlinsert1@email.com');


--SELECT 1 as id, 'test@email.com' as email into NEW;
--NEW RECORD;
-- DO $$ 
-- <<updatetriggers_block>>
-- DECLARE
--   storedproc text;
-- BEGIN 
	
	
-- 	-- hack to replace RETURN val; by void returns
-- 	--SELECT regexp_replace(prosrc, '(\s|\t)(R|r)(E|e)(T|t)(U|u)(R|r)(N|n)(\s|\t)+[^;]+;', 'return;', 'g') FROM pg_proc WHERE proname = 'testtrigger_change' into storedproc;
-- 	-- insert a NEW variable to fake the trigger
-- 	--storedproc = regexp_replace(storedproc, 'DECLARE(\s)', 'DECLARE NEW RECORD;');
-- 	-- insert the definition of NEW after BEGIN
-- 	--storedproc = regexp_replace(storedproc, 'BEGIN(\s)', 'BEGIN SELECT 1 as id, ''test@email.com'' as email into NEW; ');
	
-- 	--RAISE LOG 'test % %',NEW.id, storedproc;

-- 	-- hack to replace RETURN val; by void returns in each trigger procs
-- 	for storedproc in select regexp_replace(prosrc, '(\s|\t)(R|r)(E|e)(T|t)(U|u)(R|r)(N|n)(\s|\t)+[^;]+;', 'return;', 'g') as procs from information_schema.triggers,pg_proc where information_schema.triggers.event_manipulation = 'UPDATE' AND information_schema.triggers.event_object_schema = 'mysql_mailtrain' AND information_schema.triggers.event_object_table = 'users' AND information_schema.triggers.action_orientation = 'ROW' AND pg_proc.proname = trim(trailing '()' from regexp_replace(action_statement, 'EXECUTE PROCEDURE\s+', '')) ORDER BY information_schema.triggers.action_order,information_schema.triggers.action_timing loop

-- 		-- insert a NEW and OLD variables to fake the trigger
-- 		storedproc = regexp_replace(storedproc, 'DECLARE(\s)', 'DECLARE NEW RECORD; OLD RECORD;');
-- 		-- insert the definition of NEW after BEGIN
-- 		storedproc = regexp_replace(storedproc, 'BEGIN(\s)', 'BEGIN SELECT 1 as id, ''test@email.com'' as email into NEW; SELECT 1 as id, ''old@email.com'' as email into OLD; ');

-- 		-- fire the trigger as an anonymous block that has NEW and OLD DECLARATIONS
-- 		EXECUTE  'DO $' || '$ ' || ' 
-- 		<<wrap_trigger_block>> 
-- 		DECLARE 
-- 		BEGIN'||
-- 		storedproc
-- 		||'END wrap_trigger_block $' || '$';
-- 	end loop;


-- END updatetriggers_block $$;


--select array_agg(procs) from (select email from mysql_mailtrain.triggertest order by id) as procs;
-- select json_agg(procs) from (select regexp_replace(prosrc, '(\s|\t)(R|r)(E|e)(T|t)(U|u)(R|r)(N|n)(\s|\t)+[^;]+;', 'return;', 'g') as prosrc from information_schema.triggers,pg_proc where information_schema.triggers.event_manipulation = 'UPDATE' AND information_schema.triggers.event_object_schema = 'mysql_mailtrain' AND information_schema.triggers.event_object_table = 'users' AND information_schema.triggers.action_orientation = 'ROW' AND pg_proc.proname = trim(trailing '()' from regexp_replace(action_statement, 'EXECUTE PROCEDURE\s+', '')) ORDER BY information_schema.triggers.action_order,information_schema.triggers.action_timing) as procs;
-- --select action_statement from information_schema.triggers where information_schema.triggers.event_manipulation = 'UPDATE' AND information_schema.triggers.event_object_schema = 'mysql_mailtrain' AND information_schema.triggers.event_object_table = 'users' AND information_schema.triggers.action_orientation = 'ROW' ;



-- DO $$ 
-- <<updatetriggers_block>>
-- DECLARE
--   storedproc text;
--   faketriggers text = ' ';
-- BEGIN 
	
-- 	--TODO extract this into a list in javascript instead of a loop here, for speed. the replace as well
-- 	-- hack to replace RETURN val; by void returns in each trigger procs
-- 	for storedproc in select regexp_replace(prosrc, '(\s|\t)(R|r)(E|e)(T|t)(U|u)(R|r)(N|n)(\s|\t)+[^;]+;', 'return;', 'g') as procs from information_schema.triggers,pg_proc where information_schema.triggers.event_manipulation = 'UPDATE' AND information_schema.triggers.event_object_schema = 'mysql_mailtrain' AND information_schema.triggers.event_object_table = 'users' AND information_schema.triggers.action_orientation = 'ROW' AND pg_proc.proname = trim(trailing '()' from regexp_replace(action_statement, 'EXECUTE PROCEDURE\s+', '')) ORDER BY information_schema.triggers.action_order,information_schema.triggers.action_timing loop

-- 		-- insert a NEW and OLD variables to fake the trigger
-- 		storedproc = regexp_replace(storedproc, 'DECLARE(\s)', 'DECLARE NEW RECORD; OLD RECORD;');
-- 		-- insert the definition of NEW after BEGIN
-- 		storedproc = regexp_replace(storedproc, 'BEGIN(\s)', 'BEGIN SELECT 1 as id, ''test@email.com'' as email into NEW; SELECT 1 as id, ''old@email.com'' as email into OLD; ');

-- 		faketriggers = faketriggers || 'DO $' || '$ ' || ' 
-- 		<<wrap_trigger_block>> 
-- 		DECLARE 
-- 		BEGIN'||
-- 		storedproc
-- 		||'END wrap_trigger_block $' || '$; ';
-- 		-- fire the trigger as an anonymous block that has NEW and OLD DECLARATIONS
-- 	end loop;
-- 	EXECUTE faketriggers;


-- END updatetriggers_block $$;

