#insert into mysql_mailtrain.employee values(default,'alice',2);

USE mqltestdb;
-- trigger wont be called if we are executing this test first
update employee set emp_name = 'MYSQL_first_op' where emp_id = 2;
-- OUR FIRST OP CAUSED THE PGRTI FIELD TO BE CREATED if we dont wait a few seconds all the operations will be queued before we're done adding the field
select sleep(1);

select 'check before update trigger' as '' ;
update employee set emp_name = 'MYSQL2' where emp_id = 6;


insert into employee(emp_id,emp_name,emp_dept_id) VALUES (DEFAULT, 'MYSQLINSERT--',2);


-- test before delete revert while a revert might be pending update
select 'check before delete trigger: we cannot delete id 4 (Postgres before trigger recreates silently in the next moment' as '';
delete from employee where emp_id = 4;
delete from employee where emp_id = 4;
delete from employee where emp_id = 4;
delete from employee where emp_id = 4;


select 'check before update trigger: we cannot update id 4 (Postgres before trigger reverts silently in the next moment' as '' ;
update employee set emp_name = 'should revert' where emp_id = 4;
-- do this again to see if we could get an out of order op  like for update -> delete with both reverting befores
select 'do this again to see if we could get an out of order op  like for update -> delete with both reverting befores' as '' ;
update employee set emp_name = 'should revert1' where emp_id = 4;
update employee set emp_name = 'should revert2' where emp_id = 4;
update employee set emp_name = 'should revert3' where emp_id = 4;


select 'to address rapid updates with altering before triggers we needed to lock the on the table name, because of asyncness ops could occur in the wrong order' as '' ;
update employee set emp_dept_id = 1 where emp_id = 5;
update employee set emp_dept_id = 2 where emp_id = 5;
update employee set emp_dept_id = 1 where emp_id = 5;
