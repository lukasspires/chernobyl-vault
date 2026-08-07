const Database=require('better-sqlite3'); 
const path=require('path'); 
const db=new Database(path.join(process.cwd(),'..','data','chernobyl-vault.db'));
console.log(JSON.stringify(db.prepare('SELECT key,value FROM settings').all(),null,2)); 
console.log(JSON.stringify(db.prepare('SELECT id,title FROM series').all(),null,2)); 
console.log(JSON.stringify(db.prepare('SELECT id,title,file_path,format,page_count FROM chapters LIMIT 20').all(),null,2)); 
db.close(); 
