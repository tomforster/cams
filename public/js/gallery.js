document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname.split("/").slice(0,-1).join("/");
    document.getElementById("button-snapshot").onclick = () => {
        const http = new XMLHttpRequest();
        http.open("POST", path + '/snapshot/livingroom', true);
        http.send();
    };

    const images = document.getElementById("images");

    const ws = new WebSocket(`ws://${window.location.href.split("//").pop()}`);
    ws.onmessage = ev => {
        const data = JSON.parse(ev.data);
        if(data)
        {
            const div = document.createElement("div");
            div.className = `col-lg-3 col-md-4 col-sm-6 col-xs-12 mb-3 ${data.fileData.type}`;
            const link = document.createElement("a");
            link.className = "card";
            link.href = `${path}/images/${data.camera}/${data.fileData.file}`;
            div.appendChild(link);
            const overlay = document.createElement("div");
            overlay.className = "overlay";
            link.appendChild(overlay);
            const imageRow = document.createElement("div");
            imageRow.className = "row";
            const imageCol = document.createElement("div");
            imageCol.className = "col";
            const image = document.createElement("img");
            image.className = "img-fluid";
            image.src = `${path}/images/${data.camera}/${data.fileData.file}`;
            imageCol.appendChild(image);
            imageRow.appendChild(imageCol);
            link.appendChild(imageRow);
            const info = document.createElement("div");
            const infoCol1 = document.createElement("div");
            const infoCol2 = document.createElement("div");
            info.className = "row";
            infoCol1.className = "col m1-1 small";
            const dateText = document.createTextNode(data.fileData.date);
            infoCol1.appendChild(dateText);
            const timeText = document.createTextNode(data.fileData.time);
            infoCol2.appendChild(timeText);
            infoCol2.className = "col m1-1 small text-right";
            info.appendChild(infoCol1);
            info.appendChild(infoCol2);
            link.appendChild(info);
            images.insertBefore(div, images.firstChild);
        }
    };
});