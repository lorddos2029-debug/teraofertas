const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const envPath=path.join(root,'.env.local');if(fs.existsSync(envPath)&&process.env.NODE_ENV!=='test'){for(const line of fs.readFileSync(envPath,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const match=line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,'');}}
const products=JSON.parse(fs.readFileSync(path.join(root,'products.json'),'utf8'));
const aliases=new Map(products.map(p=>['/produto/'+p.id+'/'+p.slug,p.slug]));const publicRoots=new Set(['pix','checkout','css','fonts','images','js',...products.map(p=>p.slug)]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const backend=import('./lib/pix.js');
const server=http.createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'')||'/';}catch{res.writeHead(400).end();return;}
 if(pathname.startsWith('/api/pix/')){try{const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size<=32768)parts.push(chunk);}if(size>32768){res.writeHead(413,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,error:'Dados acima do limite.'}));return;}const body=Buffer.concat(parts);const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}:{} )});const response=await(await backend).handlePix(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){console.error('local_api_error',{type:error.name});res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,error:'Não foi possível processar o pagamento.'}));}return;}
 if(aliases.has(pathname))pathname='/'+aliases.get(pathname);
 const first=pathname.split('/')[1];if(pathname.split('/').some(p=>p.startsWith('.'))||(!['/','/index.html','/products.json'].includes(pathname)&&!publicRoots.has(first))){res.writeHead(404).end('Arquivo não encontrado');return;}
 let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.statSync(file).isFile())throw Error();}catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'}).end('<h1>Página não encontrada</h1><a href="/">Voltar ao catálogo</a>');return;}
 if(!types[path.extname(file)]){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});fs.createReadStream(file).pipe(res);
});
const port=Number(process.env.PORT)||4317;server.listen(port,'127.0.0.1',()=>console.log('Loja PC Gamer: http://127.0.0.1:'+port));server.on('error',error=>{console.error(error.message);process.exit(1)});
