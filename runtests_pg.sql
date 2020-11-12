select 'RUNNING TESTS';


insert into fs_mqltestdb.employee values(default,'firsop_pg',2);
select 'OUR FIRST OP CAUSED THE PGRTI FIELD TO BE CREATED if we dont wait a few seconds all the operations will be queued before we are done creating the structures';
select pg_sleep(3); 

select 'check that the before insert trigger runs only once';
insert into fs_mqltestdb.employee values(default,'runoncealice',2);
select emp_id,emp_name,emp_dept_id,trigg_count from fs_mqltestdb.employee;




select 'check before update trigger';
update fs_mqltestdb.employee set emp_name = 'pgupdate--' where emp_id = 3;
select emp_id,emp_name,emp_dept_id,trigg_count from fs_mqltestdb.employee;

select 'check before insert trigger: we cannot insert id 42';
insert into fs_mqltestdb.employee values(42,'PRESENCEWOULDBEABUGalice',2);
select emp_id,emp_name,emp_dept_id,trigg_count from fs_mqltestdb.employee;

select 'check before insert trigger: we can insert id 43';
insert into fs_mqltestdb.employee values(43,'alice',2);
select emp_id,emp_name,emp_dept_id,trigg_count from fs_mqltestdb.employee;



select 'check before update trigger: we cannot update id 4';
update fs_mqltestdb.employee set emp_name = 'should fail' where emp_id = 4;
select emp_id,emp_name,emp_dept_id,trigg_count from fs_mqltestdb.employee;

select 'check before delete trigger: we cannot delete id 4';
delete from fs_mqltestdb.employee where emp_id = 4;
select emp_id,emp_name,emp_dept_id,trigg_count from fs_mqltestdb.employee;

select 'test delete id 1';
delete from fs_mqltestdb.employee where emp_id = 1;
select emp_id,emp_name,emp_dept_id,trigg_count from fs_mqltestdb.employee;

