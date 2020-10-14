// Client code
const ZongJi = require('zongji');
const pg = require('pg');
var mysql1      = require('mysql');
var AsyncLock = require('async-lock');

var lock = new AsyncLock();
var fs = require('fs'),


//we could watch more than one schema at once with zongji, or have sepearate deamons 
//mysqldbwatched='mqltestdb';

zongji_conf = {
  host     : 'localhost',
  user     : 'pgtriggersd',
  password : 'pointandshoot',
};


pgconfig = {
    user: 'fdw_user',
    password: 'this_1s_fdw_us3r',
    host: 'localhost',
    port: '5432',
    database: 'testdb_pg'
};

mysqlconfig =  {
  multipleStatements: true,
  host     : 'localhost',
  user     : 'pgtriggerscl',
  password : 'pointandshoot2',
  database: 'mqltestdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};


configPath =  __dirname +'/notversioned.rosettable.conf';
if(fs.existsSync(configPath))
{
	console.log("READING rosettable CONFIGURATION, NOT INTEGRATED TESTING")
	var parsed = JSON.parse(fs.readFileSync(configPath, 'UTF-8'));
	zongji_conf = parsed.zongji_conf;
	pgconfig = parsed.pgconfig;
	mysqlconfig = parsed.mysqlconfig;
}

const zongji = new ZongJi(zongji_conf);
const pgpool = new pg.Pool(pgconfig);
const mysqlpool = mysql1.createPool(mysqlconfig);


function logwithoutrecursion(objpar)
{
	// use this to print a recursive stucture
	var cache = [];
	console.log(JSON.stringify(objpar, function(key, value) {
	    if (typeof value === 'object' && value !== null) {
	        if (cache.indexOf(value) !== -1) {
	            // Duplicate reference found, discard key
	            return;
	        }
	        // Store value in our collection
	        cache.push(value);
	    }
	    return value;
	}, 4));
	cache = null; // Enable garbage collection

}


function isSame(a,b) {
	  if(a.length != b.length){
	  	
	  	return false;
	  } 
	  if(a.filter(function(i) {return a.indexOf(i) < 0;}).length > 0){
	  	
	  	     return false;
	  }
	  if(b.filter(function(i) {return a.indexOf(i) < 0;}).length > 0)
	     return false;
	  return true;
};
function subtract(a, b) {
    var r = {};

    // For each property of 'b'
    // if it's different than the corresponding property of 'a'
    // place it in 'r'
    for (var key in b) {
        if (Array.isArray(b[key])) {
           if(!a[key]) a[key] = [];
           if(!isSame(a[key],b[key]))
               r[key] = a[key];
        } else if (typeof(b[key]) == 'object' && b[key] != null && a[key] != null) {
        	if(Object.prototype.toString.call(b[key]) === '[object Date]' && Object.prototype.toString.call(a[key]) === '[object Date]'){
        	        		if(b[key].getTime() != a[key].getTime())
        	        			r[key] = a[key]
        	 }else{
	             if (!a[key]) a[key] = {};
	             r[key] = subtract(a[key], b[key]);
	         }
        } else {
            if (b[key] != a[key]) {
                r[key] = a[key];
            }
        }
    }
    return r;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// acting as a very simple mutex, node is single threaded ans we should have a single instance of this deamon running
var addingpgrtimutex = false;
async function addpgrti(evtrow,foreignschemas,tableName,pgclient)
{
	// lets first try to catch any ongoing udpate operations -- this is transient and not garranteed, if we dont catch an update issued from pg we'll get the triggers fired twice (this could occur only on first event); 
	// maybe this could run inside the mysql_fdw, that way w'd be garanteed to be in transaction? but where would we put the results?
	// var alltxsQ = `select json_agg(pgstat.query) from (select * from pg_stat_activity where datname = '`+pgconfig.database+`' AND query ILIKE '%`+tableName+`%' AND 
	// 		query not like 'select json_agg(pgstat.query) from (select%' AND 
	// 		query not like 'select json_agg(procs) as procs%' AND
	// 		query not like '%alter FOREIGN table %`+tableName+`% add pgrti%'
	// 		) as pgstat;`;
	// const alltxs = await pgclient.query(alltxsQ);
	// console.log('ALLTXS:'+JSON.stringify(alltxs.rows[0].json_agg));
	// // if we have on ongoing tx in postgres for this table we'll assume this initial event orginated in postgres.
	// // this is not 100 fool proof, there's a chance the tx is over because of some lag, but we are doing our best to 
	// // not fire the trigger twice
	// if(alltxs.rows[0].json_agg != null){
	// 	// by setting the pgrti here we are identifying this initial operation as a postgres issued op
	// 	evtrow.pgrti = 42;
	// 	console.log('SET TO NOT RUN TRIGGERS, INITIAL CRUD COMMING FROM PG')
	// }
	// this is a critical section, we only want to add the pgrti col and triggers once
	lock.acquire('addpgrti', async function() {
			
		if(addingpgrtimutex == false)
		{

			addingpgrtimutex = true;
			console.log("ALTERING SCHEMAS TO ADD A PGRTI COL AND TRIGGERS")
			//;(async function() {
				

				// this is the first time we see an update on this table, we'll add our special field to this table in mysql
				//mysqlpool.query(`ALTER TABLE `+tableName+` ADD pgrti BIGINT DEFAULT NULL;`);


				// mysqlpool.getConnection(function(err, connection) {
				//   if (err) throw err; // not connected!

				//   // Use the connection
				//   connection.query(`ALTER TABLE `+tableName+` ADD pgrti BIGINT DEFAULT NULL;`, function (error, results, fields) {
				//     // When done with the connection, destroy it.
				//     connection.destroy();

				//     // Handle error after the release.
				//     if (error) throw error;

				//     // Don't use the connection here, it has been returned to the pool.
				//   });
				// });

				// instead of restarting our pool we make sure our connection is not reused 
				// const connection = mysql.createConnection(mysqlconfig);
				// await connection.execute(`ALTER TABLE `+tableName+` ADD pgrti BIGINT DEFAULT NULL;`);
				// connection.end();

				// use other mysql client, mysql2 client has a problem with the schema mod?
				var connection = mysql1.createConnection(mysqlconfig);
				connection.connect();
				connection.query(`ALTER TABLE `+tableName+` ADD pgrti BIGINT DEFAULT NULL;LOCK TABLES `+tableName+`  WRITE;`, async function (error, results, fields) {
				  // if (error) throw error;
				  // console.log('The solution is: ', results[0].solution);
				
				
				
				
				// and in postgres foreach mapped schema
				console.log('foreignschemas:'+JSON.stringify(foreignschemas));
				for (var i = 0; i < foreignschemas.length; i++) {
					foreignschemas[i]
					 await pgclient.query(`
						alter FOREIGN table `+foreignschemas[i]+`.`+tableName+` add pgrti bigint DEFAULT NULL;

						CREATE OR REPLACE FUNCTION aaatrig_upins_pgrti() returns trigger
			AS $$
			DECLARE
			BEGIN
				-- this check is in case this trggier gets called before the pgrti col is added. May happen on database restore for example
				IF NOT(row_to_json(NEW)->'pgrti' is NULL) THEN
					-- there is as a non zero chance the update trigger can be fired twice...
					-- there is also a strange bug that on BEFORE INSERT the NEW.pgrti gets 0 instead of a random!
					NEW.pgrti = (9223372036854773427*random());
				END IF;
			  --RAISE LOG 'aaatrig_upins_pgrti';
			  --RAISE NOTICE 'aaatrig_upins_pgrti %', row_to_json(NEW)::text;
			  return NEW;

			END;
			$$ LANGUAGE plpgsql;

			CREATE OR REPLACE FUNCTION aaatrig_del_pgrti() returns trigger
			AS $$
			DECLARE
			trigrow json; 
			whereClause text DEFAULT 'WHERE ';
			key text;
			value text;
			excstr text; 
			BEGIN
				trigrow = row_to_json(OLD);
				--RAISE NOTICE 'trigrow:%',trigrow;
				-- build a where clause to match exactly our row
				FOR key, value in select * from json_each_text(trigrow) LOOP
					IF value is NULL THEN
						whereClause = whereClause || key || ' is null AND '; 
					ELSE
						whereClause = whereClause || key || ' = ''' || value || ''' AND '; 
					END IF;
				END LOOP;
				whereClause = regexp_replace(whereClause, 'AND\\s*$', '');
				--RAISE NOTICE 'whereClause:%',whereClause;
				-- this check is in case this trigger gets called before the pgrti col is added. May happen on database restore for example
				IF NOT(trigrow->'pgrti' is NULL) THEN
					--we wrap the next statement with session_replication_role to prevent firing the update triggers in pg
					--SET session_replication_role = replica;
					ALTER TABLE `+foreignschemas[i]+`.`+tableName+` DISABLE TRIGGER aaatrigup_pgrti;
					RAISE NOTICE 'silently setting pgrti to -42424242 to mark this delete as coming from pg';
					 -- this is sentinel value, by changing the value we'll ignore the update in our mysql binlog watch deamon, the sentinel value tags this as a pg delete.
					EXECUTE('UPDATE '||TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME||' set pgrti = -42424242 ' || whereClause || ';');
					--SET session_replication_role = DEFAULT;
					ALTER TABLE `+foreignschemas[i]+`.`+tableName+` ENABLE TRIGGER aaatrigup_pgrti;
				END IF;
				--RAISE LOG 'aaatrig_del_pgrti';
				--RAISE NOTICE 'aaatrig_del_pgrti %', row_to_json(OLD)::text;
			  return OLD;

			END;
			$$ LANGUAGE plpgsql;
			DROP TRIGGER IF EXISTS aaatrigup_pgrti ON `+foreignschemas[i]+`.`+tableName+`;
			DROP TRIGGER IF EXISTS aaatrigins_pgrti ON `+foreignschemas[i]+`.`+tableName+`;
			DROP TRIGGER IF EXISTS aaatrigdel_pgrti ON `+foreignschemas[i]+`.`+tableName+`;
			CREATE TRIGGER aaatrigup_pgrti BEFORE UPDATE ON `+foreignschemas[i]+`.`+tableName+` FOR EACH ROW EXECUTE PROCEDURE aaatrig_upins_pgrti();
			CREATE TRIGGER aaatrigins_pgrti BEFORE INSERT ON `+foreignschemas[i]+`.`+tableName+` FOR EACH ROW EXECUTE PROCEDURE aaatrig_upins_pgrti();
			CREATE TRIGGER aaatrigdel_pgrti BEFORE DELETE ON `+foreignschemas[i]+`.`+tableName+` FOR EACH ROW EXECUTE PROCEDURE aaatrig_del_pgrti();
					`);
				}
			//})()

			});

			connection.end();
			// this is very weird and a hack, if we dont slow down a bit, the actual event that triggerd adding pgrti will not see the new col
			await sleep(100);
			console.log("DONE ALTERING SCHEMAS")
		}
	});
}

function pgsql_storedProcsQuery(evt,event_manipulation,action_timing)
{	
	//regexp_replace(regexp_replace(prosrc, '([\\\s|;])--[^\\\n]*', '\\1', 'g'), '([\\\s|;])RETURN(\\\s)+[^;]+;', '\\1', 'ig')
	var pgsql_storedProcs = `select json_agg(procs) as procs, json_agg(foreignschemas) as foreignschemas from (
		select regexp_replace(prosrc, '([\\\s|;])--[^\\\n]*', '\\1', 'g') as prosrc,foreign_table_schema as foreignschema, information_schema.triggers.trigger_name as trigger_name,information_schema.triggers.action_timing as action_timing, information_schema.triggers.action_statement as action_statement from 
		(
			select distinct foreign_table_schema from  information_schema.foreign_table_options WHERE 
				information_schema.foreign_table_options.foreign_table_catalog = '`+pgconfig.database+`' AND 
				information_schema.foreign_table_options.option_name = 'dbname' AND 
				information_schema.foreign_table_options.option_value = '`+evt.tableMap[evt.tableId].parentSchema+`') as foreign_table_schema,
			information_schema.triggers,pg_proc WHERE 
		information_schema.triggers.event_object_schema = foreign_table_schema AND 								 								
		information_schema.triggers.event_object_table = '`+evt.tableMap[evt.tableId].tableName+`' AND 
		information_schema.triggers.event_manipulation = '`+event_manipulation.toUpperCase()+`' AND`;
		if( !(action_timing === undefined))
			pgsql_storedProcs+=`information_schema.triggers.action_timing = '`+action_timing.toUpperCase()+`' AND`;	
		pgsql_storedProcs+=`
		information_schema.triggers.action_orientation = 'ROW' AND 
		( pg_proc.proname = split_part(regexp_replace(action_statement, 'EXECUTE PROCEDURE\\\s+', ''),'(',1) OR 
		  pg_proc.proname = split_part(regexp_replace(action_statement, 'EXECUTE FUNCTION\\\s+', ''),'(',1)) AND 
		pg_proc.proname NOT LIKE '%_pgrti'
			ORDER BY information_schema.triggers.action_timing,information_schema.triggers.action_order) as procs,
		(select json_object_agg(foreign_table_schema, cols) as foreignschemas from (select foreign_table_schema, json_object_agg(information_schema.columns.column_name, information_schema.columns.data_type) as cols from  information_schema.foreign_table_options,information_schema.columns WHERE
		information_schema.foreign_table_options.foreign_table_schema = information_schema.columns.table_schema AND 
		information_schema.foreign_table_options.foreign_table_catalog = 'testdb_pg' AND 
		information_schema.foreign_table_options.option_name = 'dbname' AND 
		information_schema.foreign_table_options.option_value = 'mqltestdb' group by foreign_table_schema) as fschemas) as foreignschemas
			;
				`;
	//console.log(pgsql_storedProcs);			
	return pgsql_storedProcs;
}

// function pgsql_fakeROW(row, name)
// {
// 	var fakeROW = '\nBEGIN\n SELECT ';
// 	for (var key in row) {
// 		var val = row[key];
// 		if(Object.prototype.toString.call(val) === '[object Date]')
// 			val = val.toISOString();
// 		if(val != null && !Number.isInteger(val))
// 			val = '\''+ val+'\'';
// 		fakeROW = ' ' + fakeROW + val + ' as '+ key + ','; 
// 	}
// 	fakeROW = fakeROW.replace(/,+$/, "") + ' into '+name+';';
// 	return fakeROW;
// }

function pgsql_fakeREC(row,tablestruc)
{
	var fakeROW = 'SELECT ';
	for (var key in row) {
		var val = row[key];
		if(Object.prototype.toString.call(val) === '[object Date]')
			val = val.toISOString();
		if(val != null && !Number.isInteger(val))
			val = '\''+ val+'\'';
		//bugfix: if we have a missing row type, it's most likely pgrti that has just been added
		var rowtype ='bigint';
		if(typeof tablestruc[key] != 'undefined')
			rowtype = tablestruc[key];
		fakeROW = ' ' + fakeROW + val + '::'+rowtype+' as '+ key + ','; 
	}
	fakeROW = fakeROW.replace(/,+$/, "");
	return fakeROW;
}

function mysql_commasetclause(jsobj)
{
	var stmt = '';
	for (var key in jsobj) {
		var val = jsobj[key];
		if(Object.prototype.toString.call(val) === '[object Date]')
			val = val.toISOString();
		if(val != null && !Number.isInteger(val))
			val = '\''+ val+'\'';
		stmt += ' ' + key + ' = '+ val + ','; 
	}
	stmt = stmt.replace(/,+$/, "");
	return stmt;
}

function mysql_commakeylist(jsobj)
{
	var stmt = '';
	for (var key in jsobj) {
		
		stmt += ' ' + key + ','; 
	}
	stmt = stmt.replace(/,+$/, "");
	return stmt;
}

function mysql_commavallist(jsobj)
{
	var stmt = '';
	for (var key in jsobj) {
		var val = jsobj[key];
		if(Object.prototype.toString.call(val) === '[object Date]')
			val = val.toISOString();
		if(val != null && !Number.isInteger(val))
			val = '\''+ val+'\'';
		stmt += ' ' + val + ','; 
	}
	stmt = stmt.replace(/,+$/, "");
	return stmt;
}

function mysql_andclause(jsobj)
{
	var stmt = '';
	for (var key in jsobj) {
		var val = jsobj[key];
		if(Object.prototype.toString.call(val) === '[object Date]')
			val = val.toISOString();
		if(val != null && !Number.isInteger(val))
			val = '\''+ val+'\'';
		if(val == null)
			stmt += ' ' + key + ' is '+ val + ' AND'; 
		else
			stmt += ' ' + key + ' = '+ val + ' AND'; 
	}
	stmt = stmt.replace(/AND$/, "");
	return stmt;
}

function pg_declaretriggervars(proc,timing,action,tableName)
{
	var tgargs = proc.action_statement.split('(')[1].split(')')[0];
	//console.log('args:'+tgargs);
	var tgargsarr = tgargs.split(',');
	//console.log(tgargsarr);
	if(tgargsarr[0] =='')
		tgargsarr = [];

	var decl = `
TG_NAME name DEFAULT '`+proc.trigger_name+`';
TG_WHEN text DEFAULT '`+timing.toUpperCase()+`';
TG_LEVEL text DEFAULT 'ROW';
TG_OP text DEFAULT '`+action.toUpperCase()+`';
TG_RELNAME name DEFAULT '`+tableName+`';
TG_TABLE_NAME name DEFAULT '`+tableName+`';
TG_TABLE_SCHEMA name DEFAULT '`+proc.foreignschema +`';
TG_NARGS integer DEFAULT `+(tgargsarr.length)+`;\n`;
if(tgargsarr.length > 1)
	decl += `TG_ARGV TEXT[] DEFAULT ARRAY[`+proc.action_statement.split('(')[1].split(')')[0]+`];\n`;
else
	decl += `TG_ARGV TEXT[] DEFAULT  ARRAY[]::TEXT[];\n`;
return decl;
}

function createtriggerwrap(procs,timing,action,tableName)
{
	const rndid = Math.floor(Math.random() * 100000000);
	var procname = 'mysqltrig'+timing.toLowerCase()+rndid;
	// TODO ADD other trigger params 
	var customprosrc = `create function pg_temp.`+procname+`(`;
	if(action == 'INSERT')
		customprosrc += `NEW RECORD`;
	else if(action == 'UPDATE')
		customprosrc += `OLD RECORD, NEW RECORD`;
	else if(action == 'DELETE')
		customprosrc += `OLD RECORD`;
	customprosrc += `) returns `;
		customprosrc += ` jsonb \n`;
	customprosrc += `AS $$
	DECLARE
	BEGIN

	-- body of each trigger in order
	`;	
	// we are executing all before triggers first to see if triggers affect NEW
	var triggercount = 0;
	for (var i = procs.length - 1; i >= 0; i--) {
		if(procs[i].action_timing.toUpperCase() == timing.toUpperCase()){
			triggercount +=1;
			
			// https://www.postgresql.org/docs/11/plpgsql-trigger.html we need to 
			// replace return X by (NEW|OLD) = X; and detect if X is null in which case we stop concat triggers, and set a flag to revert this operation silently (delete if insert) (undelete) etc
			//regexp_replace(procsr, '([\\\s|;])RETURN(\\\s)+[^;]+;', '\\1', 'ig')
			var retvar;
			if(action == 'INSERT' || action == 'UPDATE'){
				retvar = 'NEW';
				//procs[i].prosrc = procs[i].prosrc.replace(/RETURN\s+([^;]+);/ig,'NEW = $1;');
			}else 
			{	
				retvar = 'OLD';
				//procs[i].prosrc = procs[i].prosrc.replace(/RETURN\s+([^;]+);/ig,'OLD = $1;');
			}
			
			// replace return statement by NEW = NEW or OLD = OLD
			procs[i].prosrc = procs[i].prosrc.replace(/RETURN\s+([^;]+);/ig,retvar + ' = $1;');

			var splitonfirstbegin = procs[i].prosrc.split(/BEGIN([\s|\t|\n|.]+)/ig);
			//console.log(JSON.stringify(splitonfirstbegin));
			var splitfirstbeginlen = splitonfirstbegin.length-1;
			// replace END; $$ by END IF; EBD; $$
			splitonfirstbegin[splitfirstbeginlen] = splitonfirstbegin[splitfirstbeginlen].substring(0, splitonfirstbegin[splitfirstbeginlen].toUpperCase().lastIndexOf('END')) +'\nEND IF;\n END;\n';
			
			// insert trigger args and an if clause to not execute if return wasn NULLed
			procs[i].prosrc = splitonfirstbegin[0].replace(/DECLARE[\s|\n]*/ig, `DECLARE \n`+ pg_declaretriggervars(procs[i],timing.toUpperCase(),action.toUpperCase(),tableName) ) + `\nBEGIN\n IF NOT(`+retvar+` is NULL) THEN\n\n` + splitonfirstbegin[splitfirstbeginlen] ; 

			customprosrc += procs[i].prosrc; 
		}
	}
	if(action == 'INSERT' || action == 'UPDATE')
		customprosrc += `return row_to_json(NEW);\n`;
	else if( action == 'DELETE')
		customprosrc += `return row_to_json(OLD);\n`;
	customprosrc += `END;
$$ LANGUAGE plpgsql;
`;
	//console.log(customprosrc);
	return {'procname':procname,'triggercount':triggercount,'customprosrc':customprosrc};
}

const delay = ms => new Promise(res => setTimeout(res, ms));
var local_generatedupdates= {};
var pending_updates={};
var pending_change_updates={};






zongji.on('binlog', function(evt) {
	
		console.log("+++++++++   :: " + evt.getTypeName() );
	  	if(evt.getTypeName() === 'UpdateRows'){
	  		
	  		// prob need to lock on table name here for ops to be in order

			
	  		// we unfortunately have to lock out other updates to the same table to ensure updates occur in order because we are potentially altering rows in before triggers
			lock.acquire(evt.tableMap[evt.tableId].tableName, async function() {
				const pgclient = await pgpool.connect()

				
				var pgsql_storedProcs = pgsql_storedProcsQuery(evt,'UPDATE');
				//console.log("pgsql_storedProcs query:"+pgsql_storedProcs);
				const res = await pgclient.query(pgsql_storedProcs);
				//console.log(res.rows[0]);
				if(res.rows.length > 0 && res.rows[0].procs != null){
					// so we have at least one ON UPDATE stored proc in pg for this table
					var procs = res.rows[0].procs;
					//console.log(procs);
					
					// these are the corresponding pg foreignschemas
					var foreignschemas = res.rows[0].foreignschemas[0];
					// for (var i = foreignschemas.length - 1; i >= 0; i--) {
					// 	foreignschemas[procs[i].foreignschema] = procs[i].foreignschema; 
					// }
					const foreignschemasarr = Object.keys(foreignschemas);

					// let's check if we have our special row
					if(!("pgrti" in evt.rows[0].before))
					{
						//console.log("about to add pgrti");
						// this is the  first time we see this table, we need to add our sentinel col
						await addpgrti(evt.rows[0].before,foreignschemasarr,evt.tableMap[evt.tableId].tableName,pgclient);
					}else{

						//console.log('local_generatedupdates:'+ JSON.stringify(local_generatedupdates));
						// if this evt occured before we had a pgrti col, or does not know about pgrti (mysql client) or did not change the pgrti (mysql) execute trigger procs's code
						if( //( !("pgrti" in evt.rows[0].before) || 
							//(evt.rows[0].before.pgrti == null &&  typeof(local_generatedupdates[evt.rows[0].after.pgrti]) == 'undefined') || 
							
							// negative list here for clarity
							!(
								// define events to be ignored: myysql originating events implies before == after for pgrti, if it's not the case we ignore
								evt.rows[0].before.pgrti != evt.rows[0].after.pgrti
								//)
								||  
								// we specifically ignore some events, set to 42 when we want to ignore first op in addpgrti, -42424242 for pre del updates, and local_generatedupdates contains local edits or reverses as keys
								typeof(local_generatedupdates[evt.rows[0].after.pgrti]) != 'undefined' || 
								evt.rows[0].after.pgrti == -42424242 || 
								evt.rows[0].before.pgrti == 42  
							)
						)
						{
							
							//detected a change comming from mysql fire postgres triggers 
							console.log("FIRE POSTGRES UPDATE TRIGGERS:" + evt.getTypeName() + ' ON ' + evt.tableMap[evt.tableId].tableName );
							//console.log("BEFORE:" + JSON.stringify(evt.rows[0].before) );
							//console.log("AFTER:" + JSON.stringify(evt.rows[0].after) );
							

							var beforeproc = createtriggerwrap(procs,'BEFORE','UPDATE',evt.tableMap[evt.tableId].tableName);
							var afterproc = createtriggerwrap(procs,'AFTER','UPDATE',evt.tableMap[evt.tableId].tableName);


							var beforetrigger_res;
							if(beforeproc.triggercount > 0 )
							{
								//var ignorerti = [];
								for (var i = evt.rows.length - 1; i >= 0; i--) {
									
									// lets check if a change is pending
									//console.log('pending_updates:'+ JSON.stringify(pending_updates,null,4));
									//console.log('evt.rows[i].before:'+ JSON.stringify(evt.rows[i].before));
									//console.log('evt.rows[i].after:'+ JSON.stringify(evt.rows[i].after));
									
									if(pending_updates[JSON.stringify(evt.rows[i].before)]){
										console.log('-------MERGING');

										var pending = pending_updates[JSON.stringify(evt.rows[i].before)];
										//delete pending_updates[JSON.stringify(evt.rows[i].before)];
										// we need to recurse there might several updates pending
										// while(pending_updates[JSON.stringify(pending)])
										// 	pending = pending_updates[JSON.stringify(evt.rows[i].before)];

										var fakeOLD = pgsql_fakeREC(pending,foreignschemas[foreignschemasarr[0]]);
										// BUGFIX: WE NEED TO ATTEMPT MERGE OF FAKE NEW HERE, prevent key override 
										var merge = JSON.parse(JSON.stringify(pending));
										for (var j = Object.keys(evt.rows[i].before).length - 1; j >= 0; j--) {
												var key = Object.keys(evt.rows[i].before)[j];
												// apply only the keys that have been modified to our synthetic NEW
												if(evt.rows[i].before[key] != evt.rows[i].after[key])
													merge[key] = evt.rows[i].after[key];
											}
										//currdbstate = JSON.stringify(evt.rows[i].after);
										//console.log('--------------currdbstate:'+currdbstate);
										// HACKATTACK
										pending_updates[JSON.stringify(evt.rows[i].before)] = evt.rows[i].after;
										evt.rows[i].after = pending;
										//console.log('-------MERGING:after'+JSON.stringify(evt.rows[i].before));
										
										var fakeNEW = pgsql_fakeREC(merge,foreignschemas[foreignschemasarr[0]]);
										// we need to add a pending from our before too
										// console.log('-------ADDING:'+JSON.stringify(pending)+"  with: "+JSON.stringify(merge));
										// pending_updates[JSON.stringify(pending)] = merge;
										// setTimeout(function(){
								  // 			delete pending_updates[JSON.stringify(pending)];
										// }, 1000);

								  		// we dont know in what state we'll find the db so we add both
										//console.log('pending_updates:'+ JSON.stringify(pending_updates,null,4));
									}
									else{
										var fakeOLD = pgsql_fakeREC(evt.rows[i].before,foreignschemas[foreignschemasarr[0]]);
										var fakeNEW = pgsql_fakeREC(evt.rows[i].after,foreignschemas[foreignschemasarr[0]]);
									}
									//console.log('-------FAKEOLD:'+ fakeOLD);
									//console.log('-------fakeNEW:'+ fakeNEW);
									beforeproc.customprosrc += `select pg_temp.`+beforeproc.procname+`(old,new) from (`+fakeOLD+`) as old,(`+fakeNEW+`) as new;`;
								}
								//console.log('beforeproc.customprosrc:'+beforeproc.customprosrc);
								beforetrigger_res =await pgclient.query(beforeproc.customprosrc);
								//console.log('beforetrigger_res'+JSON.stringify(beforetrigger_res));
								

								var updtstmt = '';
								for (var i = evt.rows.length - 1; i >= 0; i--) {
									// beforetrigger_res is offset by 1 because the first row of the res is for the creation of our wrapper function
									var postbeforetrigger_row=beforetrigger_res[i+1].rows[0][beforeproc.procname];
									//console.log('postbeforetrigger_row'+JSON.stringify(postbeforetrigger_row));
									if(postbeforetrigger_row == null)
									{
										console.log('BEFORE UPDATE TRIGGER evt row:'+i+ ' returned NULL we silently undo the UPDATE!:'+JSON.stringify(evt.rows[i]));
										
										// BUG HERE TO FIX: WE NEED TO CHECK IF WE HAVE A PENDING REVERT ON THIS EDIT: THE PROBLEM IS THE RANDOM PGRTI MESSSes things up. probably removing the pgrti from the pending_updates hash would fix it

										//console.log('pending_updates:'+ JSON.stringify(pending_updates));
										//console.log('evt.rows[i].before:'+ JSON.stringify(evt.rows[i].before));
										//console.log('evt.rows[i].after:'+ JSON.stringify(evt.rows[i].after));

										
										
										// lets check if this update is actually awaiting a revert that has not occured yet
										if(pending_updates[JSON.stringify(evt.rows[i].before)]  )
										{
											var orig = pending_updates[JSON.stringify(evt.rows[i].before)];
											// to silently UPDATE row, we pgrti to a new value, as if this update came from postgres
											orig.pgrti = Math.floor(Math.random() * 100000000);
											var setrowclause = mysql_commasetclause(orig);
											// we remove pgrti from where clause to make sure the concurrent op does not prevent the change; could it occur after our revert?
											var afterminuspgrti = JSON.parse(JSON.stringify(evt.rows[i].after));
											delete afterminuspgrti.pgrti;
											var whererowclause = mysql_andclause(afterminuspgrti);
											pending_updates[JSON.stringify(evt.rows[i].after)] = orig;
											updtstmt += 'UPDATE '+evt.tableMap[evt.tableId].tableName+' SET '+setrowclause+' WHERE ' + whererowclause + ';';
										}else
										{


											// to silently UPDATE row, we pgrti to a new value, as if this update came from postgres
											evt.rows[i].before.pgrti = Math.floor(Math.random() * 100000000);
											local_generatedupdates[evt.rows[i].before.pgrti] = evt.rows[i].before.pgrti;
											var setrowclause = mysql_commasetclause(evt.rows[i].before);
											
											// we remove pgrti from where clause to make sure the concurrent op does not prevent the change; could it occur after our revert?
											var afterminuspgrti = JSON.parse(JSON.stringify(evt.rows[i].after));
											delete afterminuspgrti.pgrti;
											var whererowclause = mysql_andclause(afterminuspgrti);
											pending_updates[JSON.stringify(evt.rows[i].after)] = evt.rows[i].before;
											// this mysql revert will not fire the trigger because we are updating pgrti
											updtstmt += 'UPDATE '+evt.tableMap[evt.tableId].tableName+' SET '+setrowclause+' WHERE ' + whererowclause + ';';
										}


										

									}else{

										var change = subtract(postbeforetrigger_row, evt.rows[i].after);

										// update silently mysql if NEW was modified by triggers
										if(Object.keys(change).length > 0)
										{

											//console.log('BEFORE TRIGGER evt row:'+i+ ' caused a change:'+JSON.stringify(change));
											console.log('GENERATING MYSQL SILENT UPDATE: for it to be silent we are resetting pgrti so the update triggers will not be fired');
											
											change.pgrti = Math.floor(Math.random() * 100000000);
											// WHY WOULD WE NEED THIS HERE? BY CHANGING THE VALUE WE AVERT THE PRESENT TRIGGER
											// WE NEED THIS TO PREVENT CIRCULAR UPDATES!!!!
											local_generatedupdates[change.pgrti] = change.pgrti;
											// 
											//local_generatedupdates[JSON.stringify(evt.rows[i].after)] = JSON.stringify(change); 
											var setrowclause = mysql_commasetclause(change);
											//console.log('setrowclause;'+setrowclause);
											// should we we remove pgrti from where clause to make sure the concurrent op does not prevent the change; could it occur after our revert?
											var afterminuspgrti = JSON.parse(JSON.stringify(evt.rows[i].after));
											delete afterminuspgrti.pgrti;
											var whererowclause = mysql_andclause(afterminuspgrti);
											//var whererowclause = mysql_andclause(evt.rows[i].after);


											//console.log('whererowclause;'+whererowclause);
										
											updtstmt += 'UPDATE '+evt.tableMap[evt.tableId].tableName+' SET '+setrowclause+' WHERE ' + whererowclause + ';';
											//console.log('AFTER'+JSON.stringify(evt.rows[i].after));
											var row = evt.rows[i].after;
											var pendingchangeJSON = JSON.stringify(evt.rows[i].after);
											//update our after row with the trigger mods							
											for (var j = Object.keys(change).length - 1; j >= 0; j--) {
												var key = Object.keys(change)[j];
												if(key != 'pgrti')
													row[key] = change[key];
											}
											pending_updates[pendingchangeJSON] = row;
											setTimeout(function(){
									  			delete pending_updates[pendingchangeJSON];
											}, 1000);

											if(pending_updates[JSON.stringify(evt.rows[i].before)])
											{
												//console.log('HACKATTACK');

												var currdbstate = JSON.stringify(pending_updates[JSON.stringify(evt.rows[i].before)]);
												delete pending_updates[JSON.stringify(evt.rows[i].before)];
												// we did a merge, we'll also add that state
												pending_updates[currdbstate] = row;
												setTimeout(function(){
										   			delete pending_updates[currdbstate];
												 }, 1000);
											}
										
										
											

											//console.log('++++++++++++++++++++pending_updates:'+ JSON.stringify(pending_updates,null,4));
											


										}
									}	
								}
								console.log(updtstmt);
								// update all rows that changed at once for efficiency
								mysqlpool.query(updtstmt);
								
							}


							// run AFTER triggers with updated row if we have after triggers
							if(afterproc.triggercount > 0)
							{
								for (var i = evt.rows.length - 1; i >= 0; i--) {

									// if we had beforetriggers, we only run aftertriggers if the result of before triggers is not null
									if(beforeproc.triggercount == 0 || beforetrigger_res[i-1] != null)
									{
										var fakeNEW = pgsql_fakeREC(evt.rows[i].after,foreignschemas[foreignschemasarr[0]]);
										var fakeOLD = pgsql_fakeREC(evt.rows[i].before,foreignschemas[foreignschemasarr[0]]);
										afterproc.customprosrc += `select pg_temp.`+afterproc.procname+`(old,new) from (`+fakeOLD+`) as old,(`+fakeNEW+`) as new;`;
									}
								}
								//console.log(afterproc.customprosrc);
								const afterres =await pgclient.query(afterproc.customprosrc);
							}

						}else
						{

							// based on pgrti this event came from pg remove these markers so next time we see these from mysql the event is fired
							for (var i = evt.rows.length - 1; i >= 0; i--) {
								delete local_generatedupdates[evt.rows[i].after.pgrti];
							}

						}


					}

				}//if(res.row.len)

				pgclient.release()
			});
			// this is required to end an anonymous async function like this ;(async function() {
			//()


			// remove if was listed as pending. we do this as late as possible to allow a update-delete to be reverted to original, there's a chance this may not work 100% of the time...
			setTimeout(function(){
				for (var i = evt.rows.length - 1; i >= 0; i--)
	  				delete pending_updates[JSON.stringify(evt.rows[i].after)];
			}, 1000);
	  		


			// POSSIBLE IMPROVEMENT could we add a catch up system to write the binlog offset in our pgrti, so that if events occured while pg was offline the triggers get processed when it comes back online 
			// we could encode the offset in pgrti by making that a bigint and kee the random bellow a certain limit; when the pg trigger fails we'll write the binlog offset+to pgrti (new op), then when pg is back (first lookup for triggers that succeeds)
			// we fire and update all pent up triggers and update the pgrtis
			//evt.dump();

			
	  	}else if(evt.getTypeName() === 'WriteRows'){ // INSERT 
	  		
	  		// anonymous asnyc fctn defined and called at once
	  		;(async function() {
				const pgclient = await pgpool.connect()
				
				var pgsql_storedProcs = pgsql_storedProcsQuery(evt,'INSERT');
				//console.log('pgsql_storedProcs:'+pgsql_storedProcs);
				const res = await pgclient.query(pgsql_storedProcs);
				//console.log('pgsql_storedProcs:'+JSON.stringify(res));
				if(res.rows.length > 0 && res.rows[0].procs != null){

					
					var procs = res.rows[0].procs;
					
					// these are the corresponding pg foreignschemas
					var foreignschemas = res.rows[0].foreignschemas[0];
					// for (var i = foreignschemas.length - 1; i >= 0; i--) {
					// 	foreignschemas[procs[i].foreignschema] = procs[i].foreignschema; 
					// }
					const foreignschemasarr = Object.keys(foreignschemas);

					if(!("pgrti" in evt.rows[0]))
					{
						await addpgrti(evt.rows[0],foreignschemasarr,evt.tableMap[evt.tableId].tableName,pgclient);
					}else{	
						//console.log(procs);


						if(!("pgrti" in evt.rows[0]) || evt.rows[0].pgrti == null )
						{
							// SMALL BUG: IF THE FIRST OPERATION came from postgres the trigger will be fired twice
							console.log("FIRE POSTGRES INSERT TRIGGERS:" + evt.getTypeName() + ' ON ' + evt.tableMap[evt.tableId].tableName);
							
							var beforeproc = createtriggerwrap(procs,'BEFORE','INSERT',evt.tableMap[evt.tableId].tableName);
							var afterproc = createtriggerwrap(procs,'AFTER','INSERT',evt.tableMap[evt.tableId].tableName);
							

							var beforetrigger_res;
							if(beforeproc.triggercount > 0 )
							{
								for (var i = evt.rows.length - 1; i >= 0; i--) {
									// all foreignschemas should be the same for this table otherwire ops would fail
									var fakeNEW = pgsql_fakeREC(evt.rows[i],foreignschemas[foreignschemasarr[0]]);
									beforeproc.customprosrc += `select pg_temp.`+beforeproc.procname+`(evtro) from (`+fakeNEW+`) as evtro;`;
								}
								//console.log('beforeproc.customprosrc\n'+beforeproc.customprosrc);
								const beforetrigger_res =await pgclient.query(beforeproc.customprosrc);
								//console.log(beforetrigger_res);
								var updtstmt = '';
								for (var i = evt.rows.length - 1; i >= 0; i--) {
									//console.log(beforetrigger_res[i+1].rows[0]);
									// beforetrigger_res[i+1] is offset by one because the first res if from the creation of our composed before trigger
									var postbeforetrigger_row=beforetrigger_res[i+1].rows[0][beforeproc.procname];

									console.log(postbeforetrigger_row);
									if(postbeforetrigger_row == null)
									{
										console.log('BEFORE TRIGGER evt row:'+i+ ' returned NULL we silently undo the insert!:'+JSON.stringify(evt.rows[i]));
										// to silently delete row, we first need to first silently set pgrti to our sentinel -42424242
										// this will not fire the trigger because we are updating pgrti
										var setrowclause = mysql_commasetclause({pgrti:-42424242});
										var whererowclause = mysql_andclause(evt.rows[i]);
										updtstmt += 'UPDATE '+evt.tableMap[evt.tableId].tableName+' SET '+setrowclause+' WHERE ' + whererowclause + ';';
										// because of previous update to sentinel value this delete will also be silent and not fire the triggers
										evt.rows[i].pgrti = -42424242;
										whererowclause = mysql_andclause(evt.rows[i]);
										updtstmt += 'DELETE FROM '+evt.tableMap[evt.tableId].tableName+' WHERE ' + whererowclause + ';';

									}else{

										var change = subtract(postbeforetrigger_row, evt.rows[i]);
										console.log('BEFORE TRIGGER evt row:'+i+ ' caused chage:'+JSON.stringify(change));

										// update silently mysql if NEW was modified by triggers
										if(Object.keys(change).length > 0)
										{
											console.log('GENERATING MYSQL SILENT UPDATE: for it to be silent we are setting pgrti so the update triggers will not be fired');
											change.pgrti = Math.floor(Math.random() * 100000000);
											local_generatedupdates[change.pgrti] = change.pgrti;
											var setrowclause = mysql_commasetclause(change);
											//console.log('setrowclause;'+setrowclause);

											var whererowclause = mysql_andclause(evt.rows[i]);
											//console.log('whererowclause;'+whererowclause);
										
											updtstmt += 'UPDATE '+evt.tableMap[evt.tableId].tableName+' SET '+setrowclause+' WHERE ' + whererowclause + ';';
			
											var row = evt.rows[i];
											//update our row with the trigger mods							
											for (var i = Object.keys(change).length - 1; i >= 0; i--) {
												var key = Object.keys(change)[i];
												if(key != 'pgrti')
													row[key] = change[key];
											}
											evt.rows[i] = row;
											//console.log('updated row:'+JSON.stringify(evt.rows[i]));
										}
									}	
								}
								//console.log(updtstmt);
								// update all rows that changed at once for efficiency
								if(updtstmt != '')
									mysqlpool.query(updtstmt);
								
							}



							// run AFTER triggers with updated row if we have after triggers
							if(afterproc.triggercount > 0)
							{
								for (var i = evt.rows.length - 1; i >= 0; i--) {
									// if we had before triggers, only run after trigger for rows that did not return null
									// if we only have after triggers we'll run them
									if(beforeproc.triggercount == 0 || beforetrigger_res[i-1] != null)
									{
										var fakeNEW = pgsql_fakeREC(evt.rows[i],foreignschemas[foreignschemasarr[0]]);
										afterproc.customprosrc += `select pg_temp.`+afterproc.procname+`(evtro) from (`+fakeNEW+`) as evtro;`;
									}
								}
								//console.log(afterproc.customprosrc);
								const afterres =await pgclient.query(afterproc.customprosrc);
							}
						}
					}
				}//if(res.rows.length > 0 && r
				pgclient.release()	

			})()

	  	}
	  	else if(evt.getTypeName() === 'DeleteRows'){

	  		;(async function() {
				const pgclient = await pgpool.connect()

				var pgsql_storedProcs = pgsql_storedProcsQuery(evt,'DELETE');
				//console.log(pgsql_storedProcs);
				const res = await pgclient.query(pgsql_storedProcs);
				if(res.rows.length > 0 && res.rows[0].procs != null){
					var procs = res.rows[0].procs;
					//console.log(procs);
					
					// these are the corresponding pg foreignschemas
					var foreignschemas = res.rows[0].foreignschemas[0];
					// for (var i = foreignschemas.length - 1; i >= 0; i--) {
					// 	foreignschemas[procs[i].foreignschema] = procs[i].foreignschema; 
					// }
					const foreignschemasarr = Object.keys(foreignschemas);

					if(!("pgrti" in evt.rows[0]))
					{
						await addpgrti(evt.rows[0],foreignschemasarr,evt.tableMap[evt.tableId].tableName,pgclient);
					}else{

						//-42424242 is sentinel value that we set in a postgres before trigger (this one is ignored by the current system) to identify deletes coming from postgres
						//42 is the sentinel when the pgrti has just been created in addpgrti
						if(!("pgrti" in evt.rows[0]) || (evt.rows[0].pgrti != -42424242 && evt.rows[0].pgrti != 42) )
						{
							console.log("FIRE POSTGRES DELETE TRIGGERS:" + evt.getTypeName() + ' ON ' + evt.tableMap[evt.tableId].tableName);
							
							var beforeproc = createtriggerwrap(procs,'BEFORE','DELETE',evt.tableMap[evt.tableId].tableName);
							var afterproc = createtriggerwrap(procs,'AFTER','DELETE',evt.tableMap[evt.tableId].tableName);

							var beforetrigger_res;
							if(beforeproc.triggercount > 0)
							{
								var inserertstmt = '';
								for (var i = evt.rows.length - 1; i >= 0; i--) {
									var fakeOLD = pgsql_fakeREC(evt.rows[i],foreignschemas[foreignschemasarr[0]]);
									beforeproc.customprosrc += `select pg_temp.`+beforeproc.procname+`(evtro) from (`+fakeOLD+`) as evtro;`;
								}
								//console.log(beforeproc.customprosrc);
								beforetrigger_res =await pgclient.query(beforeproc.customprosrc);


								for (var i = evt.rows.length - 1; i >= 0; i--) {
									// before trig res offset by one because the first stmt is to create the temp trigger wrapper
									var postbeforetrigger_row=beforetrigger_res[i+1].rows[0][beforeproc.procname];

									console.log(postbeforetrigger_row);
									if(postbeforetrigger_row == null)
									{
										console.log('BEFORE TRIGGER evt row:'+i+ ' returned NULL we silently undo the DELETE!:'+JSON.stringify(evt.rows[i]));
										// to silently re-insert row, we need to set pgrti 
										// this will not fire the trigger because we are updating pgrti

										//console.log('pending_updates:'+ JSON.stringify(pending_updates));
										if(pending_updates[JSON.stringify(evt.rows[i])]  )
										{
											// we have a pending revert, we insert that instead!
											evt.rows[i] = pending_updates[JSON.stringify(evt.rows[i])];
											delete pending_updates[JSON.stringify(evt.rows[i])];
										}

										evt.rows[i].pgrti = Math.floor(Math.random() * 100000000);
										inserertstmt += 'INSERT INTO '+evt.tableMap[evt.tableId].tableName+' ('+mysql_commakeylist(evt.rows[i]) +') '+' VALUES (' + mysql_commavallist(evt.rows[i]) + ');';
									}
								}
								if(inserertstmt != '')
									mysqlpool.query(inserertstmt);
								
								
							}

							if(afterproc.triggercount > 0)
							{
								for (var i = evt.rows.length - 1; i >= 0; i--) {
									// after triggers are canceled if a before trigger returned NULL
									if(beforeproc.triggercount == 0 || beforetrigger_res[i-1] != null)
									{
										var fakeOLD = pgsql_fakeREC(evt.rows[i],foreignschemas[foreignschemasarr[0]]);
										afterproc.customprosrc += `select pg_temp.`+afterproc.procname+`(evtro) from (`+fakeOLD+`) as evtro;`;
									}
								}
								//console.log(afterproc.customprosrc);
								const afterres =await pgclient.query(afterproc.customprosrc);
							}
						}
					}
				}//if(res.rows.length > 0 && 
				pgclient.release()	

			})()
	  	}	  	
	});


zongji.on('ready', function(evt) {
  console.log('ready');
	 
});

console.log("about to start trigers_mysql_pg");
zongji.start({
  //Unique number int32 >= 1  to identify this replication slave instance. Must be specified if running more than one instance of ZongJi. Must be used in start() method for effect. Default: 1
  serverId : 1,
  startAtEnd: true,
  includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows'],
  includeSchema: {'mqltestdb': true
   }
});

process.on('SIGINT', function() {
  console.log('Got SIGINT.');
  zongji.stop();
  process.exit();
});