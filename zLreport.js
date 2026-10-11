(() => {
    console.log("🚀 Excluded REDISTRIBUTION & BATCH Filters Applied Strictly on Overwrite Map Store!");

    const STORAGE_KEY = "ZEPTO_CLEAN_SCRAPED_DATA";

    const headers = [
        "Picklist ID", "Status", 
        "Assigned Qty", "Assigned SKUs", 
        "Picked Qty", "Pending Qty", "Total Short Qty", 
        "Cancelled Qty", "Cancelled SKUs", 
        "Picker",
        "Zone", "Totes", "Picking Type", "Creation Mode", 
        "Source Store", "Next Destination Store", "Final Destination", 
        "Orders", "Batch Details", "Cluster Zone", 
        "Created At", "Start Time", "End Time", "Created By", "Cutoff Time"
    ];

    window.masterPicklistMap = {};
    window.isAutoScrapingActive = false;
    window.crawlDirection = "FORWARD";

    // Restore saved object from Local Storage
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                parsed.forEach(r => {
                    if (r && r[0]) window.masterPicklistMap[r[0]] = r;
                });
            } else {
                window.masterPicklistMap = parsed;
            }
        }
    } catch (e) {}

    // Shift Date Matching Logic (5 AM Operational Cutoff)
    const isTodayOrCurrentShift = (dateText) => {
        if (!dateText || dateText.trim() === "" || dateText === "-") return true; 

        const now = new Date();
        let targetDate = new Date(now);

        if (now.getHours() < 5) targetDate.setDate(now.getDate() - 1);

        const dayStr = String(targetDate.getDate()).padStart(2, '0');
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthShort = monthNames[targetDate.getMonth()];

        const formatted1 = `${dayStr}-${monthShort}`;
        const formatted2 = `${dayStr} ${monthShort}`;

        if (dateText.toLowerCase().includes(formatted1.toLowerCase()) || dateText.toLowerCase().includes(formatted2.toLowerCase())) return true;

        const parsedDate = new Date(dateText.replace(/(\d+)(st|nd|rd|th)/, '$1'));
        if (!isNaN(parsedDate.getTime())) {
            return ((now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60)) <= 29;
        }

        return true; 
    };

    const parseHourString = (dateStr) => {
        if (!dateStr || dateStr === "-") return null;
        let d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            const parts = dateStr.split(',');
            if (parts.length > 1) d = new Date(parts[1].trim() + " " + parts[0].trim());
        }
        if (isNaN(d.getTime())) return null;

        let hours = d.getHours();
        let ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours} ${ampm}`;
    };

    const parseFullDate = (dateStr) => {
        if (!dateStr || dateStr === "-") return null;
        let d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            const parts = dateStr.split(',');
            if (parts.length > 1) d = new Date(parts[1].trim() + " " + parts[0].trim());
        }
        return isNaN(d.getTime()) ? null : d;
    };

    const getHourWeight = (hourStr) => {
        const parts = hourStr.split(' ');
        let h = parseInt(parts[0]);
        const ampm = parts[1];
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h;
    };

    const getHourlyColorStyle = (val) => {
        if (val === 0) return 'background: rgba(255, 77, 79, 0.25); color: #ff7875; border: 1px solid #ff4d4f; font-weight: 800; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);';
        if (val < 20) return 'background: linear-gradient(180deg, #ff7875 0%, #ff4d4f 100%); color: #ffffff; font-weight: 800; border: 1px solid #d9363e; box-shadow: 0 2px 5px rgba(255,77,79,0.4);';
        if (val < 50) return 'background: linear-gradient(180deg, #ffc069 0%, #fa8c16 100%); color: #ffffff; font-weight: 800; border: 1px solid #d48806; box-shadow: 0 2px 5px rgba(250,140,22,0.4);';
        if (val < 100) return 'background: linear-gradient(180deg, #ffd591 0%, #faad14 100%); color: #1f1f1f; font-weight: 800; border: 1px solid #d48806; box-shadow: 0 2px 5px rgba(250,173,20,0.4);';
        return 'background: linear-gradient(180deg, #73d13d 0%, #237804 100%); color: #ffffff; font-weight: 800; border: 1px solid #276749; box-shadow: 0 0 10px rgba(82, 196, 26, 0.6); text-shadow:0 1px 2px rgba(0,0,0,0.3);';
    };

    const extractLivePageDataWithValidation = () => {
        const rowElements = Array.from(document.querySelectorAll('tbody tr, [role="rowgroup"] [role="row"], .ag-center-cols-container .ag-row'));
        let cleanRows = [];
        let hasInvalidDateRow = false;

        rowElements.forEach(row => {
            let cells = Array.from(row.querySelectorAll('td, [role="gridcell"], .ag-cell'));
            if (cells.length > 0 && (cells[0].innerText.trim() === "" || cells[0].querySelector('input[type="checkbox"]'))) cells.shift();

            if (cells.length >= 5) {
                let processedRow = [];

                processedRow.push(cells[0] ? cells[0].innerText.trim() : "-");
                processedRow.push(cells[1] ? cells[1].innerText.trim() : "-");

                let assignedText = cells[2] ? cells[2].innerText.replace(/\s+/g, ' ').trim() : "-";
                let assignedQty = assignedText.match(/^\d+/) ? assignedText.match(/^\d+/)[0] : "-";
                let assignedSkus = assignedText.match(/\d+\s*SKUs?/i) ? assignedText.match(/\d+\s*SKUs?/i)[0] : "-";
                processedRow.push(assignedQty, assignedSkus);

                let ppText = cells[3] ? cells[3].innerText.replace(/\s+/g, ' ').trim() : "-";
                let pickedQty = "-";
                let pendingQty = "-";
                
                if (ppText.includes('/')) {
                    let parts = ppText.split('/');
                    pickedQty = parts[0].trim();
                    let afterSlash = parts[1].trim();
                    let pendingMatch = afterSlash.match(/^\d+/);
                    pendingQty = pendingMatch ? pendingMatch[0] : "0";
                } else {
                    let fallback = ppText.match(/^\d+/);
                    pickedQty = fallback ? fallback[0] : "-";
                    pendingQty = "0";
                }

                let shortMatch = ppText.match(/(\d+\s*Short)/i);
                let totalShortQty = shortMatch ? shortMatch[0] : "0 Short";
                processedRow.push(pickedQty, pendingQty, totalShortQty);

                let cancelledText = cells[4] ? cells[4].innerText.replace(/\s+/g, ' ').trim() : "-";
                let cancelledQty = cancelledText.match(/^\d+/) ? cancelledText.match(/^\d+/)[0] : "0";
                let cancelledSkus = cancelledText.match(/\d+\s*SKUs?/i) ? cancelledText.match(/\d+\s*SKUs?/i)[0] : "0 SKUs";
                processedRow.push(cancelledQty, cancelledSkus);

                processedRow.push(cells[5] ? cells[5].innerText.trim() || "-" : "-");

                for (let index = 6; index < 21; index++) {
                    if (cells[index]) {
                        let text = cells[index].innerText.replace(/\s+/g, ' ').trim();
                        processedRow.push(text || "-");
                    } else {
                        processedRow.push("-");
                    }
                }

                if (isTodayOrCurrentShift(processedRow[21] || "")) {
                    cleanRows.push(processedRow);
                } else {
                    hasInvalidDateRow = true;
                }
            }
        });

        return { cleanRows, hasInvalidDateRow };
    };

    const createDashboardDOM = () => {
        const dashboard = document.createElement('div');
        dashboard.id = 'perfect-split-dashboard';
        dashboard.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background: radial-gradient(circle at top left, #1a0f2e, #0c0919, #05040a); z-index:9999999; overflow:hidden; font-family: "Segoe UI", Roboto, sans-serif; display:flex; flex-direction:column; color:#fff;';

        const styleTag = document.createElement('style');
        styleTag.textContent = `
            @keyframes pulseGlow {
                0% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.8); }
                70% { box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
            }
            .live-dot {
                width: 8px; height: 8px; background: #ff4d4f; border-radius: 50%; display: inline-block; animation: pulseGlow 1.8s infinite; margin-right: 6px;
            }
        `;
        document.head.appendChild(styleTag);

        const topBar = document.createElement('div');
        topBar.style.cssText = 'background: rgba(255, 255, 255, 0.04); backdrop-filter: blur(25px); border-bottom: 1px solid rgba(255, 255, 255, 0.12); padding:14px 28px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);';
        
        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        
        const titleText = document.createElement('h1');
        titleText.style.cssText = 'margin:0; font-size:22px; font-weight:900; letter-spacing:1px; background: linear-gradient(135deg, #ffffff 0%, #d3ade6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 20px rgba(211, 173, 230, 0.4);';
        titleText.textContent = 'ZEPTO OPERATIONS';

        const subPill = document.createElement('div');
        subPill.style.cssText = 'display:flex; align-items:center; gap:12px; font-size:11px; font-weight:800; color:#e6f7ff;';
        subPill.innerHTML = `
            <span style="background: rgba(255, 255, 255, 0.08); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); display:flex; align-items:center;">
                <span class="live-dot"></span> LIVE SHIFT OVERVIEW (AM JUMP-START)
            </span>
            <span style="color:#00f5ff; font-weight:700;" id="telemetry-sweep-mode">Sweep: FORWARD</span>
            <span style="color:#b37feb; font-weight:700;" id="telemetry-records-count">Active Records: 0</span>
            <span style="background: rgba(255, 77, 79, 0.2); color:#ff7875; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(255, 77, 79, 0.4);">5:00 AM CUTOFF</span>
        `;
        
        titleContainer.appendChild(titleText);
        titleContainer.appendChild(subPill);

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex; gap:10px; align-items:center;';

        const autoNextBtn = document.createElement('button');
        autoNextBtn.id = 'auto-fetch-all-btn';
        autoNextBtn.style.cssText = 'background: linear-gradient(135deg, #00f5ff 0%, #0088ff 100%); color:#001529; border:none; padding:10px 18px; border-radius:30px; font-weight:800; cursor:pointer; font-size:12px; box-shadow:0 0 15px rgba(0, 245, 255, 0.5); transition:all 0.3s;';
        autoNextBtn.textContent = '⚡ INFINITE SWEEP LOOP';
        autoNextBtn.onclick = () => {
            window.isAutoScrapingActive = !window.isAutoScrapingActive;
            if (window.isAutoScrapingActive) {
                autoNextBtn.style.background = 'linear-gradient(135deg, #faad14 0%, #d48806 100%)';
                autoNextBtn.style.color = '#fff';
                autoNextBtn.textContent = '⏸ PAUSE LOOP';
                startAutoPaginationStep();
            } else {
                autoNextBtn.style.background = 'linear-gradient(135deg, #00f5ff 0%, #0088ff 100%)';
                autoNextBtn.style.color = '#001529';
                autoNextBtn.textContent = '⚡ INFINITE SWEEP LOOP';
            }
        };

        const rawDataModalBtn = document.createElement('button');
        rawDataModalBtn.style.cssText = 'background: rgba(255, 120, 117, 0.18); color:#ff9c6e; border:1px solid rgba(255, 120, 117, 0.35); padding:10px 16px; border-radius:30px; font-weight:700; cursor:pointer; font-size:12px; backdrop-filter:blur(10px);';
        rawDataModalBtn.textContent = '📄 VIEW RAW DATA';
        rawDataModalBtn.onclick = () => showRawDataModal();

        const clearStorageBtn = document.createElement('button');
        clearStorageBtn.style.cssText = 'background: rgba(250, 140, 22, 0.18); color:#ffc069; border:1px solid rgba(250, 140, 22, 0.35); padding:10px 16px; border-radius:30px; font-weight:700; cursor:pointer; font-size:12px;';
        clearStorageBtn.textContent = '🗑️ CLEAR DATA';
        clearStorageBtn.onclick = () => {
            localStorage.removeItem(STORAGE_KEY);
            window.masterPicklistMap = {};
            renderAllReports();
        };

        const exportCsvBtn = document.createElement('button');
        exportCsvBtn.style.cssText = 'background: linear-gradient(135deg, #52c41a 0%, #237804 100%); color:white; border:none; padding:10px 18px; border-radius:30px; font-weight:800; cursor:pointer; font-size:12px; box-shadow:0 0 12px rgba(82, 196, 26, 0.4);';
        exportCsvBtn.textContent = '📊 EXPORT CSV (UTF-8)';
        exportCsvBtn.onclick = () => exportScrapedCSV();

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background: rgba(255, 255, 255, 0.1); color:#bfbfbf; border:1px solid rgba(255, 255, 255, 0.2); padding:10px 16px; border-radius:30px; font-weight:700; cursor:pointer; font-size:12px;';
        closeBtn.textContent = '❌ CLOSE';
        closeBtn.onclick = () => {
            dashboard.remove();
            window.isAutoScrapingActive = false;
            if (window.liveTableObserver) window.liveTableObserver.disconnect();
            if (window.countdownInterval) clearInterval(window.countdownInterval);
        };

        btnGroup.appendChild(autoNextBtn);
        btnGroup.appendChild(rawDataModalBtn);
        btnGroup.appendChild(clearStorageBtn);
        btnGroup.appendChild(exportCsvBtn);
        btnGroup.appendChild(closeBtn);

        topBar.appendChild(titleContainer);
        topBar.appendChild(btnGroup);
        dashboard.appendChild(topBar);

        const reportContainer = document.createElement('div');
        reportContainer.id = 'all-reports-scroll-container';
        reportContainer.style.cssText = 'flex-grow:1; overflow-y:auto; padding:24px 28px; display:flex; flex-direction:column; gap:24px;';

        dashboard.appendChild(reportContainer);
        document.body.appendChild(dashboard);
    };

    const createGlassCard = (icon, titleText, gradientHeader, cardBg, accentGlowColor) => {
        const card = document.createElement('div');
        card.style.cssText = `background: ${cardBg}; backdrop-filter: blur(25px); border-radius: 18px; border: 2px solid rgba(255, 255, 255, 0.15); border-left: 6px solid ${accentGlowColor}; padding: 18px 22px; box-shadow: 0 12px 35px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.25); display:inline-flex; flex-direction:column; gap:12px; width: fit-content; max-width: 100%;`;

        const h = document.createElement('h3');
        h.style.cssText = `margin:0; font-size:14px; font-weight:900; letter-spacing:0.8px; text-transform:uppercase; background: ${gradientHeader}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; width:100%; display:flex; align-items:center; gap:8px;`;
        h.innerHTML = `<span>${icon}</span> <span>${titleText}</span>`;

        card.appendChild(h);
        return card;
    };

    const createProgressBar = (pct, colorHex) => {
        return `
            <div style="width: 90px; background: rgba(255,255,255,0.08); height: 6px; border-radius: 4px; overflow: hidden; margin-top: 4px;">
                <div style="width: ${Math.min(100, Math.max(0, pct))}%; background: ${colorHex}; height: 100%; border-radius: 4px; box-shadow: 0 0 8px ${colorHex};"></div>
            </div>
        `;
    };

    // Render All Reports
    const renderAllReports = () => {
        const container = document.getElementById('all-reports-scroll-container');
        const telemetryRecords = document.getElementById('telemetry-records-count');
        const telemetrySweep = document.getElementById('telemetry-sweep-mode');
        if (!container) return;

        const combinedData = Object.values(window.masterPicklistMap);

        if (telemetryRecords) telemetryRecords.textContent = `Active Records: ${combinedData.length}`;
        if (telemetrySweep) telemetrySweep.textContent = `Sweep: ${window.crawlDirection}`;

        container.textContent = '';

        // ROW 1: 3 Side-by-Side Cards
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:20px; align-items:flex-start; width:100%;';

        // 1. STATUS WISE SUMMARY (Exclude REDISTRIBUTION)
        const statusCard = createGlassCard('📊', 'STATUS WISE SUMMARY', 'linear-gradient(135deg, #ff7875, #b37feb)', 'rgba(255, 77, 79, 0.06)', '#ff4d4f');
        const statusTable = document.createElement('table');
        statusTable.style.cssText = 'border-collapse:separate; border-spacing:0 6px; color:#e6f7ff; font-size:12px; text-align:left; width:auto;';

        const statusAgg = {};
        combinedData.forEach(r => {
            let status = r[1] || "Unknown";
            let pickingType = r[12] || "";
            let zone = r[10] || "";

            // EXCLUDE REDISTRIBUTION
            if (status.toUpperCase().includes("REDISTRIBUTION") || pickingType.toUpperCase().includes("REDISTRIBUTION") || zone.toUpperCase().includes("REDISTRIBUTION")) return;

            if (!statusAgg[status]) statusAgg[status] = { assignedQty: 0, pickedQty: 0, pendingQty: 0, totes: 0 };
            statusAgg[status].assignedQty += parseInt(r[2]) || 0;
            statusAgg[status].pickedQty += parseInt(r[4]) || 0;
            statusAgg[status].pendingQty += parseInt(r[5]) || 0;
            statusAgg[status].totes += parseInt(r[11]) || 0;
        });

        let statusHeader = document.createElement('tr');
        statusHeader.style.cssText = 'background: rgba(255, 255, 255, 0.05);';
        ["Status Tag", "Assigned", "Picked", "Pending", "Totes"].forEach(h => {
            let th = document.createElement('th');
            th.style.cssText = 'padding:8px 12px; font-weight:800; color:#ff9c6e; white-space:nowrap; border-bottom:1px solid rgba(255,255,255,0.12);';
            th.textContent = h;
            statusHeader.appendChild(th);
        });
        statusTable.appendChild(statusHeader);

        Object.keys(statusAgg).forEach((key) => {
            let tr = document.createElement('tr');
            tr.style.cssText = 'background: rgba(255, 255, 255, 0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.08);';
            
            let sData = statusAgg[key];
            let pctPicked = sData.assignedQty ? (sData.pickedQty / sData.assignedQty) * 100 : 0;

            let pillBg = "background: rgba(24, 144, 255, 0.25); color: #69c0ff; border: 1px solid #1890ff;";
            let barColor = "#1890ff";

            if (key.toUpperCase().includes("PROGRESS")) {
                pillBg = "background: rgba(82, 196, 26, 0.25); color: #95de64; border: 1px solid #52c41a;";
                barColor = "#52c41a";
            } else if (key.toUpperCase().includes("PACKED") || key.toUpperCase().includes("COMPLETE")) {
                pillBg = "background: rgba(24, 144, 255, 0.25); color: #69c0ff; border: 1px solid #1890ff;";
                barColor = "#1890ff";
            } else if (key.toUpperCase().includes("READY")) {
                pillBg = "background: rgba(250, 173, 20, 0.25); color: #ffd666; border: 1px solid #faad14;";
                barColor = "#faad14";
            }

            let tdStatus = document.createElement('td');
            tdStatus.style.cssText = 'padding:8px 12px; white-space:nowrap;';
            tdStatus.innerHTML = `<span style="padding:4px 10px; border-radius:12px; font-weight:800; font-size:11px; ${pillBg}">${key}</span>`;
            tr.appendChild(tdStatus);

            let tdAssigned = document.createElement('td');
            tdAssigned.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#ffd666;';
            tdAssigned.textContent = sData.assignedQty;
            tr.appendChild(tdAssigned);

            let tdPicked = document.createElement('td');
            tdPicked.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:800; color:#95de64;';
            tdPicked.innerHTML = `${sData.pickedQty} ${createProgressBar(pctPicked, barColor)}`;
            tr.appendChild(tdPicked);

            let tdPending = document.createElement('td');
            tdPending.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#ff7875;';
            tdPending.textContent = sData.pendingQty;
            tr.appendChild(tdPending);

            let tdTotes = document.createElement('td');
            tdTotes.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#d3ade6;';
            tdTotes.textContent = sData.totes;
            tr.appendChild(tdTotes);

            statusTable.appendChild(tr);
        });
        statusCard.appendChild(statusTable);

        // 2. PICKING TYPE SUMMARY
        const pickingCard = createGlassCard('🏷️', 'PICKING TYPE SUMMARY', 'linear-gradient(135deg, #ffd666, #ff7875)', 'rgba(250, 173, 20, 0.06)', '#faad14');
        const pickingTable = document.createElement('table');
        pickingTable.style.cssText = 'border-collapse:separate; border-spacing:0 6px; color:#e6f7ff; font-size:12px; text-align:left; width:auto;';

        const pickingAgg = {};
        combinedData.forEach(r => {
            let key = r[12] || "Unknown";
            if (!pickingAgg[key]) pickingAgg[key] = { assignedQty: 0, pickedQty: 0, pendingQty: 0, totes: 0 };
            pickingAgg[key].assignedQty += parseInt(r[2]) || 0;
            pickingAgg[key].pickedQty += parseInt(r[4]) || 0;
            pickingAgg[key].pendingQty += parseInt(r[5]) || 0;
            pickingAgg[key].totes += parseInt(r[11]) || 0;
        });

        let pickingHeader = document.createElement('tr');
        pickingHeader.style.cssText = 'background: rgba(255, 255, 255, 0.05);';
        ["Picking Type", "Assigned", "Picked", "Pending", "Totes"].forEach(h => {
            let th = document.createElement('th');
            th.style.cssText = 'padding:8px 12px; font-weight:800; color:#ffd666; white-space:nowrap; border-bottom:1px solid rgba(255,255,255,0.12);';
            th.textContent = h;
            pickingHeader.appendChild(th);
        });
        pickingTable.appendChild(pickingHeader);

        Object.keys(pickingAgg).forEach((key) => {
            let tr = document.createElement('tr');
            tr.style.cssText = 'background: rgba(255, 255, 255, 0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.08);';

            let pData = pickingAgg[key];
            let pctPicked = pData.assignedQty ? (pData.pickedQty / pData.assignedQty) * 100 : 0;

            let typeIcon = "📄";
            if (key.toUpperCase().includes("SINGLE")) typeIcon = "✏️";
            else if (key.toUpperCase().includes("MULTI")) typeIcon = "🔲";
            else if (key.toUpperCase().includes("BATCH")) typeIcon = "📄";
            else if (key.toUpperCase().includes("ZONE")) typeIcon = "📍";

            let tdType = document.createElement('td');
            tdType.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:800; color:#ffe58f;';
            tdType.innerHTML = `<span style="margin-right:6px;">${typeIcon}</span> ${key}`;
            tr.appendChild(tdType);

            let tdAssigned = document.createElement('td');
            tdAssigned.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#ffd666;';
            tdAssigned.textContent = pData.assignedQty;
            tr.appendChild(tdAssigned);

            let tdPicked = document.createElement('td');
            tdPicked.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:800; color:#95de64;';
            tdPicked.innerHTML = `${pData.pickedQty} ${createProgressBar(pctPicked, '#faad14')}`;
            tr.appendChild(tdPicked);

            let tdPending = document.createElement('td');
            tdPending.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#ff7875;';
            tdPending.textContent = pData.pendingQty;
            tr.appendChild(tdPending);

            let tdTotes = document.createElement('td');
            tdTotes.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#d3ade6;';
            tdTotes.textContent = pData.totes;
            tr.appendChild(tdTotes);

            pickingTable.appendChild(tr);
        });
        pickingCard.appendChild(pickingTable);

        // 3. ZONE WISE SUMMARY (Exclude REDISTRIBUTION & BATCH)
        const zoneCard = createGlassCard('🗺️', 'ZONE WISE SUMMARY', 'linear-gradient(135deg, #36cfc9, #40a9ff)', 'rgba(19, 194, 194, 0.06)', '#13c2c2');
        const zoneTable = document.createElement('table');
        zoneTable.style.cssText = 'border-collapse:separate; border-spacing:0 6px; color:#e6f7ff; font-size:12px; text-align:left; width:auto;';

        const zoneAgg = {};
        combinedData.forEach(r => {
            let zone = r[10] || "Unknown";
            let pickingType = r[12] || "";
            let status = r[1] || "";

            // EXCLUDE REDISTRIBUTION & BATCH
            if (zone.toUpperCase().includes("REDISTRIBUTION") || pickingType.toUpperCase().includes("REDISTRIBUTION") || status.toUpperCase().includes("REDISTRIBUTION") ||
                zone.toUpperCase().includes("BATCH") || pickingType.toUpperCase().includes("BATCH") || status.toUpperCase().includes("BATCH")) return;

            if (!zoneAgg[zone]) zoneAgg[zone] = { assignedQty: 0, pickedQty: 0, pendingQty: 0, totes: 0 };
            zoneAgg[zone].assignedQty += parseInt(r[2]) || 0;
            zoneAgg[zone].pickedQty += parseInt(r[4]) || 0;
            zoneAgg[zone].pendingQty += parseInt(r[5]) || 0;
            zoneAgg[zone].totes += parseInt(r[11]) || 0;
        });

        let zoneHeader = document.createElement('tr');
        zoneHeader.style.cssText = 'background: rgba(255, 255, 255, 0.05);';
        ["Zone Label", "Assigned", "Picked", "Pending", "Totes"].forEach(h => {
            let th = document.createElement('th');
            th.style.cssText = 'padding:8px 12px; font-weight:800; color:#36cfc9; white-space:nowrap; border-bottom:1px solid rgba(255,255,255,0.12);';
            th.textContent = h;
            zoneHeader.appendChild(th);
        });
        zoneTable.appendChild(zoneHeader);

        Object.keys(zoneAgg).forEach((key) => {
            let tr = document.createElement('tr');
            tr.style.cssText = 'background: rgba(255, 255, 255, 0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.08);';
            let zData = zoneAgg[key];
            let pctPicked = zData.assignedQty ? (zData.pickedQty / zData.assignedQty) * 100 : 0;

            let zoneDisplay = key;
            if (key.toUpperCase().includes("ZONE A")) zoneDisplay = "Zone A - High Velocity";
            else if (key.toUpperCase().includes("ZONE B")) zoneDisplay = "Zone B - Cold Storage";
            else if (key.toUpperCase().includes("ZONE C")) zoneDisplay = "Zone C - Bulk";
            else if (key.toUpperCase().includes("ZONE D")) zoneDisplay = "Zone D - Zone Picking";

            let tdZone = document.createElement('td');
            tdZone.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:800; color:#e6fffb;';
            tdZone.textContent = zoneDisplay;
            tr.appendChild(tdZone);

            let tdAssigned = document.createElement('td');
            tdAssigned.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#ffd666;';
            tdAssigned.textContent = zData.assignedQty;
            tr.appendChild(tdAssigned);

            let tdPicked = document.createElement('td');
            tdPicked.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:800; color:#95de64;';
            tdPicked.innerHTML = `${zData.pickedQty} ${createProgressBar(pctPicked, '#36cfc9')}`;
            tr.appendChild(tdPicked);

            let tdPending = document.createElement('td');
            tdPending.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#ff7875;';
            tdPending.textContent = zData.pendingQty;
            tr.appendChild(tdPending);

            let tdTotes = document.createElement('td');
            tdTotes.style.cssText = 'padding:8px 12px; white-space:nowrap; font-weight:700; color:#d3ade6;';
            tdTotes.textContent = zData.totes;
            tr.appendChild(tdTotes);

            zoneTable.appendChild(tr);
        });
        zoneCard.appendChild(zoneTable);

        topRow.appendChild(statusCard);
        topRow.appendChild(pickingCard);
        topRow.appendChild(zoneCard);
        container.appendChild(topRow);

        // BOTTOM ROW: 2 Large Split Panels
        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:20px; align-items:flex-start; width:100%;';

        // 1. IDLE PICKERS PANEL
        const freePickersCard = createGlassCard('⏸', 'IDLE PICKERS (PENDING QTY = 0 & LIVE COUNTDOWN)', 'linear-gradient(135deg, #00f5ff, #36cfc9)', 'rgba(0, 245, 255, 0.03)', '#00f5ff');
        freePickersCard.style.flex = '1';
        freePickersCard.style.minWidth = '380px';

        const freeTable = document.createElement('table');
        freeTable.style.cssText = 'border-collapse:separate; border-spacing:0 6px; color:#e6f7ff; font-size:12px; text-align:left; width:100%;';

        let freeHeader = document.createElement('tr');
        freeHeader.style.cssText = 'background: rgba(255, 255, 255, 0.05);';
        ["Picker Name", "Picked", "Last Pick Time", "Status", "Idle Timer"].forEach(h => {
            let th = document.createElement('th');
            th.style.cssText = 'padding:8px 12px; font-weight:800; color:#00f5ff; white-space:nowrap; border-bottom:1px solid rgba(255,255,255,0.12);';
            th.textContent = h;
            freeHeader.appendChild(th);
        });
        freeTable.appendChild(freeHeader);

        const hourSet = new Set();
        const pickerMap = {};

        combinedData.forEach(r => {
            const picker = r[9] || "Unknown";
            const assigned = parseInt(r[2]) || 0;
            const picked = parseInt(r[4]) || 0;
            const endTimeStr = r[22]; 
            const zone = r[10] || "";
            const pickingType = r[12] || "";
            const status = r[1] || "";

            if (zone.toUpperCase().includes("REDISTRIBUTION") || pickingType.toUpperCase().includes("REDISTRIBUTION") || status.toUpperCase().includes("REDISTRIBUTION") ||
                zone.toUpperCase().includes("BATCH") || pickingType.toUpperCase().includes("BATCH") || status.toUpperCase().includes("BATCH")) return;

            const hr = parseHourString(endTimeStr);
            if (hr) hourSet.add(hr);

            const endDate = parseFullDate(endTimeStr);

            if (!pickerMap[picker]) {
                pickerMap[picker] = { assignedQty: 0, pickedQty: 0, hourlyPicked: {}, lastPickDate: null };
            }

            pickerMap[picker].assignedQty += assigned;
            pickerMap[picker].pickedQty += picked;

            if (endDate) {
                if (!pickerMap[picker].lastPickDate || endDate > pickerMap[picker].lastPickDate) {
                    pickerMap[picker].lastPickDate = endDate;
                }
            }

            if (hr) {
                pickerMap[picker].hourlyPicked[hr] = (pickerMap[picker].hourlyPicked[hr] || 0) + picked;
            }
        });

        let freePickersFound = 0;
        Object.keys(pickerMap).forEach(picker => {
            let pData = pickerMap[picker];
            let pending = Math.max(0, pData.assignedQty - pData.pickedQty);

            if (pending === 0) {
                freePickersFound++;
                let tr = document.createElement('tr');
                tr.style.cssText = 'background: rgba(255, 255, 255, 0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.08);';

                let tdName = document.createElement('td');
                tdName.style.cssText = 'padding:8px 12px; font-weight:800; color:#d3ade6; white-space:nowrap;';
                tdName.innerHTML = `<span style="margin-right:6px;">👤</span> ${picker}`;
                tr.appendChild(tdName);

                let tdPicked = document.createElement('td');
                tdPicked.style.cssText = 'padding:8px 12px; font-weight:800; color:#95de64;';
                tdPicked.textContent = pData.pickedQty;
                tr.appendChild(tdPicked);

                let tdLastTime = document.createElement('td');
                tdLastTime.style.cssText = 'padding:8px 12px; font-weight:600; color:#bfbfbf; white-space:nowrap;';
                tdLastTime.textContent = pData.lastPickDate ? pData.lastPickDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
                tr.appendChild(tdLastTime);

                let tdStatus = document.createElement('td');
                tdStatus.style.cssText = 'padding:8px 12px; white-space:nowrap;';
                tdStatus.innerHTML = `<span style="background: rgba(82, 196, 26, 0.25); color: #95de64; border: 1px solid #52c41a; padding: 2px 8px; border-radius: 10px; font-weight: 800; font-size: 10px;">🟢 IDLE / NO TASK</span>`;
                tr.appendChild(tdStatus);

                let tdTimer = document.createElement('td');
                tdTimer.style.cssText = 'padding:6px 10px; white-space:nowrap;';
                tdTimer.innerHTML = `
                    <span class="free-picker-timer-cell" data-last-time="${pData.lastPickDate ? pData.lastPickDate.getTime() : ''}" style="background: rgba(250, 140, 22, 0.25); color: #ffc069; border: 1px solid #fa8c16; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 11px; box-shadow: 0 0 8px rgba(250, 140, 22, 0.4);">
                        ⏱️ Calculating...
                    </span>
                `;
                tr.appendChild(tdTimer);

                freeTable.appendChild(tr);
            }
        });

        if (freePickersFound === 0) {
            let tr = document.createElement('tr');
            let td = document.createElement('td');
            td.colSpan = 5;
            td.style.cssText = 'padding:12px; text-align:center; color:#8c8c8c; font-weight:600;';
            td.textContent = "✔ All Pickers are currently assigned to active picklists.";
            tr.appendChild(td);
            freeTable.appendChild(tr);
        }

        freePickersCard.appendChild(freeTable);

        // 2. HOURLY IPP PERFORMANCE & PICKER RANKING (Exclude REDISTRIBUTION & BATCH)
        const ippCard = createGlassCard('🏆', 'HOURLY IPP PERFORMANCE & PICKER RANKING', 'linear-gradient(135deg, #b37feb, #ff7875)', 'rgba(179, 127, 235, 0.05)', '#b37feb');
        ippCard.style.flex = '2';
        ippCard.style.minWidth = '500px';

        const ippTableWrapper = document.createElement('div');
        ippTableWrapper.style.cssText = 'overflow-x:auto; width:100%;';

        const ippTable = document.createElement('table');
        ippTable.style.cssText = 'border-collapse:separate; border-spacing:0 6px; color:#e6f7ff; font-size:12px; text-align:left; width:100%;';

        const sortedHours = Array.from(hourSet).sort((a, b) => getHourWeight(a) - getHourWeight(b));

        let ippHeader = document.createElement('tr');
        ippHeader.style.cssText = 'background: rgba(255, 255, 255, 0.05);';

        ["Rank", "Picker Name", "Assigned", "Picked", "Pending"].forEach(h => {
            let th = document.createElement('th');
            th.style.cssText = 'padding:8px 12px; font-weight:800; color:#b37feb; white-space:nowrap; border-bottom:1px solid rgba(255,255,255,0.12);';
            th.textContent = h;
            ippHeader.appendChild(th);
        });

        sortedHours.forEach(hr => {
            let th = document.createElement('th');
            th.style.cssText = 'padding:8px 10px; font-weight:800; color:#69c0ff; text-align:center; white-space:nowrap; border-bottom:1px solid rgba(255,255,255,0.12);';
            th.textContent = hr;
            ippHeader.appendChild(th);
        });

        ippTable.appendChild(ippHeader);

        const rankedPickers = Object.keys(pickerMap).sort((a, b) => pickerMap[b].pickedQty - pickerMap[a].pickedQty);

        rankedPickers.forEach((picker, rankIdx) => {
            let tr = document.createElement('tr');
            tr.style.cssText = 'background: rgba(255, 255, 255, 0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.08);';

            let pData = pickerMap[picker];
            let pending = Math.max(0, pData.assignedQty - pData.pickedQty);

            let tdRank = document.createElement('td');
            tdRank.style.cssText = 'padding:8px 12px; font-weight:900; text-align:center; white-space:nowrap;';
            if (rankIdx === 0) tdRank.innerHTML = '<span style="color:#ffd700;">🥇 #1</span>';
            else if (rankIdx === 1) tdRank.innerHTML = '<span style="color:#c0c0c0;">🥈 #2</span>';
            else if (rankIdx === 2) tdRank.innerHTML = '<span style="color:#cd7f32;">🥉 #3</span>';
            else tdRank.textContent = `#${rankIdx + 1}`;
            tr.appendChild(tdRank);

            let tdName = document.createElement('td');
            tdName.style.cssText = 'padding:8px 12px; font-weight:800; color:#d3ade6; white-space:nowrap;';
            tdName.innerHTML = `<span style="margin-right:6px;">👤</span> ${picker}`;
            tr.appendChild(tdName);

            let tdAssigned = document.createElement('td');
            tdAssigned.style.cssText = 'padding:8px 12px; font-weight:700; color:#ffd666;';
            tdAssigned.textContent = pData.assignedQty;
            tr.appendChild(tdAssigned);

            let tdPicked = document.createElement('td');
            tdPicked.style.cssText = 'padding:8px 12px; font-weight:800; color:#95de64;';
            tdPicked.textContent = pData.pickedQty;
            tr.appendChild(tdPicked);

            let tdPending = document.createElement('td');
            tdPending.style.cssText = 'padding:8px 12px; font-weight:700; color:#ff7875;';
            tdPending.textContent = pending;
            tr.appendChild(tdPending);

            sortedHours.forEach(hr => {
                let val = pData.hourlyPicked[hr] || 0;
                let td = document.createElement('td');
                td.style.cssText = `padding:6px 8px; text-align:center; border-radius:6px; white-space:nowrap; ${getHourlyColorStyle(val)}`;
                td.textContent = val;
                tr.appendChild(td);
            });

            ippTable.appendChild(tr);
        });

        ippTableWrapper.appendChild(ippTable);
        ippCard.appendChild(ippTableWrapper);

        bottomRow.appendChild(freePickersCard);
        bottomRow.appendChild(ippCard);
        container.appendChild(bottomRow);

        updateFreePickersCountdowns();
    };

    const updateFreePickersCountdowns = () => {
        if (window.countdownInterval) clearInterval(window.countdownInterval);

        const timerCells = document.querySelectorAll('.free-picker-timer-cell');

        const refreshTimers = () => {
            const now = Date.now();
            timerCells.forEach(cell => {
                const lastTimeMs = parseInt(cell.getAttribute('data-last-time'));
                if (!lastTimeMs) {
                    cell.textContent = "⏱️ No Activity";
                    return;
                }

                const diffMs = Math.max(0, now - lastTimeMs);
                const diffMins = Math.floor(diffMs / (1000 * 60));
                const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
                const diffHrs = Math.floor(diffMins / 60);

                const padSecs = String(diffSecs).padStart(2, '0');
                const padMins = String(diffMins % 60).padStart(2, '0');

                if (diffHrs > 0) {
                    cell.textContent = `⏱️ ${diffHrs}h ${padMins}m ${padSecs}s`;
                } else {
                    cell.textContent = `⏱️ ${padMins}m ${padSecs}s`;
                }
            });
        };

        refreshTimers();
        window.countdownInterval = setInterval(refreshTimers, 1000);
    };

    const showRawDataModal = () => {
        let modal = document.getElementById('raw-data-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'raw-data-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); backdrop-filter:blur(16px); z-index:10000000; display:flex; flex-direction:column; padding:24px;';

        const modalHeader = document.createElement('div');
        modalHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;';

        const title = document.createElement('h3');
        title.style.cssText = 'margin:0; color:#fff; font-size:16px; font-weight:800;';
        title.textContent = '📄 RAW EXTRACTED SCRAPED PICKLIST ROWS';

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:#ff4d4f; color:white; border:none; padding:8px 16px; border-radius:20px; cursor:pointer; font-weight:bold;';
        closeBtn.textContent = 'CLOSE VIEW';
        closeBtn.onclick = () => modal.remove();

        modalHeader.appendChild(title);
        modalHeader.appendChild(closeBtn);
        modal.appendChild(modalHeader);

        const tableWrapper = document.createElement('div');
        tableWrapper.style.cssText = 'flex-grow:1; overflow:auto; background:rgba(255,255,255,0.03); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.1);';

        const table = document.createElement('table');
        table.style.cssText = 'width:100%; border-collapse:collapse; color:#fff; font-size:12px; white-space:nowrap;';

        const combinedData = Object.values(window.masterPicklistMap);

        const headerRow = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.style.cssText = 'padding:10px; border-bottom:2px solid rgba(255,255,255,0.2); color:#69c0ff; text-align:left; background:rgba(255,255,255,0.05);';
            th.textContent = h;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        combinedData.forEach(r => {
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom:1px solid rgba(255,255,255,0.05);';
            r.forEach(cell => {
                const td = document.createElement('td');
                td.style.cssText = 'padding:8px 10px;';
                td.textContent = cell || '-';
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        tableWrapper.appendChild(table);
        modal.appendChild(tableWrapper);
        document.body.appendChild(modal);
    };

    const exportScrapedCSV = () => {
        const combinedData = Object.values(window.masterPicklistMap);

        if (combinedData.length === 0) {
            alert("Export karne ke liye koi data nahi hai!");
            return;
        }

        let csvContent = "\uFEFF"; 
        csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

        combinedData.forEach(row => {
            let rowContent = row.map(cell => {
                let text = cell ? String(cell).replace(/"/g, '""') : "-";
                return `"${text}"`;
            }).join(",");
            csvContent += rowContent + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", url);
        downloadAnchor.setAttribute("download", `picklist_data_${Date.now()}.csv`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        URL.revokeObjectURL(url);
    };

    const pushNewScreenData = () => {
        const { cleanRows, hasInvalidDateRow } = extractLivePageDataWithValidation();

        if (cleanRows.length > 0) {
            cleanRows.forEach(r => {
                if (r && r[0]) {
                    window.masterPicklistMap[r[0]] = r;
                }
            });
            
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(window.masterPicklistMap));
            } catch (e) {}

            renderAllReports();
        }

        return { hasInvalidDateRow, currentCount: cleanRows.length };
    };

    // Infinite Sweep Loop Step (1 ➔ N ➔ 1 Sweep)
    const startAutoPaginationStep = () => {
        if (!window.isAutoScrapingActive) return;

        const { hasInvalidDateRow } = pushNewScreenData();

        const nextBtnCandidate = Array.from(document.querySelectorAll('button, a, .ant-pagination-next, .ag-paging-button, li[title="Next Page"], [aria-label="Next Page"]')).find(el => {
            const txt = el.innerText.toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const isNext = txt.includes('next') || txt.includes('>') || aria.includes('next') || title.includes('next');
            return isNext && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled && !el.classList.contains('disabled');
        });

        const prevBtnCandidate = Array.from(document.querySelectorAll('button, a, .ant-pagination-prev, .ag-paging-button, li[title="Previous Page"], [aria-label="Previous Page"]')).find(el => {
            const txt = el.innerText.toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const isPrev = txt.includes('prev') || txt.includes('<') || aria.includes('prev') || title.includes('prev');
            return isPrev && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled && !el.classList.contains('disabled');
        });

        if (window.crawlDirection === "FORWARD" && (hasInvalidDateRow || !nextBtnCandidate)) {
            console.log("🛑 Cutoff or End reached. Reversing sweep direction to REVERSE...");
            window.crawlDirection = "REVERSE";
        } else if (window.crawlDirection === "REVERSE" && !prevBtnCandidate) {
            console.log("🔄 Reached Page 1. Switching sweep direction to FORWARD...");
            window.crawlDirection = "FORWARD";
        }

        let targetBtn = window.crawlDirection === "FORWARD" ? nextBtnCandidate : prevBtnCandidate;

        if (targetBtn) {
            const firstCellBefore = document.querySelector('td, [role="gridcell"], .ag-cell');
            const prevId = firstCellBefore ? firstCellBefore.innerText.trim() : "";

            targetBtn.click();

            let attempts = 0;
            const maxAttempts = 30;

            const waitInterval = setInterval(() => {
                attempts++;
                const firstCellAfter = document.querySelector('td, [role="gridcell"], .ag-cell');
                const currId = firstCellAfter ? firstCellAfter.innerText.trim() : "";

                if ((currId !== prevId && currId !== "") || attempts >= maxAttempts) {
                    clearInterval(waitInterval);

                    setTimeout(() => {
                        if (window.isAutoScrapingActive) {
                            startAutoPaginationStep();
                        }
                    }, 500);
                }
            }, 500);

        } else {
            window.crawlDirection = window.crawlDirection === "FORWARD" ? "REVERSE" : "FORWARD";
            setTimeout(() => {
                if (window.isAutoScrapingActive) startAutoPaginationStep();
            }, 600);
        }
    };

    // Init Execution
    const existing = document.getElementById('perfect-split-dashboard');
    if (existing) existing.remove();
    if (window.liveTableObserver) window.liveTableObserver.disconnect();
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    window.crawledPageCount = 0;
    window.crawlDirection = "FORWARD";

    createDashboardDOM();
    pushNewScreenData();

    const targetNode = document.querySelector('tbody, [role="rowgroup"], .ag-center-cols-container') || document.body;
    
    window.liveTableObserver = new MutationObserver(() => {
        clearTimeout(window.liveTableTimeout);
        window.liveTableTimeout = setTimeout(() => {
            pushNewScreenData();
        }, 300);
    });

    window.liveTableObserver.observe(targetNode, { childList: true, subtree: true });
    console.log("🚀 Fit-to-Text Ultra-Vibrant Glassmorphism Dashboard Rendered!");
})();
