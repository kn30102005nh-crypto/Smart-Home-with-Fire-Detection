let labels=[], gas=[], temp=[], humi=[];
const MAX=60;

const gasC=new Chart(gasChart,{type:'line',
  data:{labels:labels,datasets:[{label:'Gas',data:gas}]}
});
const tC=new Chart(tempChart,{type:'line',
  data:{labels:labels,datasets:[{label:'Temp',data:temp}]}
});
const hC=new Chart(humiChart,{type:'line',
  data:{labels:labels,datasets:[{label:'Humi',data:humi}]}
});

function update(){
  fetch('/data')
  .then(r=>r.json())
  .then(d=>{
    gas.push(d.gas); temp.push(d.t); humi.push(d.h);
    labels.push(new Date().toLocaleTimeString());
    if(labels.length>MAX){
      labels.shift(); gas.shift(); temp.shift(); humi.shift();
    }
    gasC.update(); tC.update(); hC.update();

    document.getElementById("gas").innerText=d.gas;
    document.getElementById("temp").innerText=d.t;
    document.getElementById("humi").innerText=d.h;
    document.getElementById("led").innerText=d.led?"ON":"OFF";

    const st=document.getElementById("status");
    if(d.alarm){
      st.innerText="🚨 GAS ALERT"; st.className="danger";
    }else{
      st.innerText="✅ SAFE"; st.className="safe";
    }
  });
}

function led(s){
  fetch('/led?state='+s);
}

update();
setInterval(update,1000);
