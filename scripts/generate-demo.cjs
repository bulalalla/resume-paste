const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');
const root=path.join(__dirname,'..');
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css=`@page{size:A4;margin:13mm}*{box-sizing:border-box}body{font-family:'Noto Sans CJK SC','Microsoft YaHei',sans-serif;font-size:10px;line-height:1.65;color:#263445;margin:0}h1{font-size:23px;margin:0 0 5px}h2{font-size:13px;border-bottom:1px solid #6b809b;padding-bottom:4px;margin:14px 0 7px}.notice{font-size:10px;color:#81564a;background:#faf1e9;padding:8px 10px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 13px}.field{break-inside:avoid}.long{grid-column:1/-1}.label{font-size:8px;color:#718198}.value{white-space:pre-wrap;overflow-wrap:anywhere}section{break-inside:auto}.proof{margin-top:50px;border:2px dashed #a8b7c6;padding:35px;font-size:14px}.proof h1{font-size:29px}.stamp{color:#a0aab6;font-size:35px;font-weight:bold;letter-spacing:4px;margin-top:70px}`;
app.whenReady().then(async()=>{
 try{
  const data=JSON.parse(await fs.readFile(path.join(root,'examples/test-resume.json'),'utf8'));
  const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});
  const render=async(html,file)=>{await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><meta charset="utf-8"><style>'+css+'</style>'+html));await win.webContents.executeJavaScript('document.fonts.ready');await fs.writeFile(path.join(root,file),await win.webContents.printToPDF({printBackground:true,pageSize:'A4',preferCSSPageSize:true}));};
  const body='<h1>示例同学 · 软件开发工程师</h1><p class="notice">虚构测试简历：全部人物、学校、单位、联系方式与经历均为功能演示数据。</p>'+data.sections.map(s=>'<section><h2>'+escape(s.title)+'</h2><div class="grid">'+s.fields.map(f=>'<div class="field '+(f.value.length>40||f.value.includes('\n')?'long':'')+'"><div class="label">'+escape(f.label)+'</div><div class="value">'+escape(f.value)+'</div></div>').join('')+'</div></section>').join('');
  await render(body,'examples/test-resume.pdf');
  await render('<div class="proof"><h1>学历证明 · 示例材料</h1><p class="notice">仅供测试文件绑定、路径复制和上传流程，不代表任何真实学历或认证。</p><p>姓名：示例同学（虚构）</p><p>学校：示例大学（虚构）</p><p>专业：计算机科学与技术</p><p>学历：本科（测试信息）</p><p>示例时间：2026 年 10 月</p><div class="stamp">DEMO / 非正式材料</div></div>','examples/materials/学历证明-示例.pdf');
  console.log('Generated fictional resume and demonstration certificate PDFs.');app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
});
