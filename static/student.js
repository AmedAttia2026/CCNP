// ==========================================
// Shared Settings & Variables (Student)
// ==========================================
const swalDark = { background: '#1F2937', color: '#fff', confirmButtonColor: '#FFB300' };

let currentSubId, currentSubName, currentAssignedCom;
let studentComplaintsData = []; 

// ==========================================
// Window Onload Dispatcher (Student)
// ==========================================
window.onload = async () => {
    const savedID = localStorage.getItem('drselem_student_id');
    const savedPass = localStorage.getItem('drselem_student_pass');
    
    if (savedID && savedPass) {
        try {
            const res = await fetch('/api/student-login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({student_id: savedID, password: savedPass})
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                const s = data.student;
                localStorage.setItem('drselem_student_name', s.name);
                localStorage.setItem('drselem_student_year', s.year);
                localStorage.setItem('drselem_student_dept', s.department);
                localStorage.setItem('drselem_student_email', s.email);
                
                document.getElementById('auth-screen').style.display = 'none';
                document.getElementById('main-ui').style.display = 'flex';
                initDashboard();
            } else {
                localStorage.clear();
            }
        } catch(e) {
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('main-ui').style.display = 'flex';
            initDashboard();
        }
    }
};

// ==========================================
// Student Functions
// ==========================================
async function changeMyPassword() {
    const { value: formValues } = await Swal.fire({
        ...swalDark,
        title: 'تغيير كلمة المرور',
        html: `
            <input id="cp-old" type="password" class="input-dark ltr-input" placeholder="كلمة المرور الحالية" style="margin-bottom:10px;">
            <input id="cp-new" type="password" class="input-dark ltr-input" placeholder="كلمة المرور الجديدة">
        `,
        preConfirm: () => {
            const oldP = document.getElementById('cp-old').value.trim();
            const newP = document.getElementById('cp-new').value.trim();
            if(!oldP || !newP) return Swal.showValidationMessage('الرجاء إدخال البيانات المطلوبة');
            if(newP.length < 4) return Swal.showValidationMessage('كلمة المرور الجديدة قصيرة جداً');
            return { old_password: oldP, new_password: newP };
        }
    });

    if(formValues) {
        Swal.fire({title: 'جاري التحديث...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            const res = await fetch('/api/student-action', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    action: 'change_password', 
                    student_id: localStorage.getItem('drselem_student_id'),
                    old_password: formValues.old_password,
                    new_password: formValues.new_password
                })
            });
            const data = await res.json();
            
            if(data.status === 'success') {
                localStorage.setItem('drselem_student_pass', formValues.new_password);
                Swal.fire({...swalDark, icon: 'success', title: 'تم تغيير كلمة المرور بنجاح!', timer: 2000, showConfirmButton: false});
            } else {
                Swal.fire({...swalDark, icon: 'error', text: data.message});
            }
        } catch(e) {
            Swal.fire({...swalDark, icon: 'error', text: 'خطأ في الاتصال بالخادم.'});
        }
    }
}

async function loginStudent() {
    let stIdInput = document.getElementById('login-id').value.trim(); const stPass = document.getElementById('login-pass').value.trim(); const stId = stIdInput.replace(/[^0-9]/g, '');
    if (stId.length !== 7) return Swal.fire({icon: 'error', text: 'رقم الـ ID يجب أن يكون 7 أرقام!', background:'#1a1f2c', color:'#fff'});
    if (!stPass) return Swal.fire({icon: 'warning', text: 'يرجى إدخال كلمة المرور!', background:'#1a1f2c', color:'#fff'});
    Swal.fire({title: 'جاري التحقق...', background:'#1a1f2c', color:'#fff', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch('/api/student-login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_id: stId, password: stPass}) });
        const data = await res.json();
        if (data.status === 'success') {
            const s = data.student; localStorage.setItem('drselem_student_id', s.student_id); localStorage.setItem('drselem_student_name', s.name); localStorage.setItem('drselem_student_year', s.year); localStorage.setItem('drselem_student_dept', s.department); localStorage.setItem('drselem_student_email', s.email); localStorage.setItem('drselem_student_pass', stPass);
            Swal.close(); document.getElementById('auth-screen').style.display = 'none'; document.getElementById('main-ui').style.display = 'flex'; initDashboard();
        } else Swal.fire({icon: 'error', text: data.message, background:'#1a1f2c', color:'#fff'});
    } catch(e) { Swal.fire({icon: 'error', text: 'حدث خطأ في الاتصال بخوادم الجامعة.', background:'#1a1f2c', color:'#fff'}); }
}

function logoutStudent() {
    Swal.fire({ title: 'تسجيل الخروج', text: "هل أنت متأكد من مسح بياناتك من هذا الجهاز؟", icon: 'warning', background: '#1a1f2c', color: '#fff', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'نعم، خروج', cancelButtonText: 'إلغاء' }).then((result) => { if (result.isConfirmed) { localStorage.clear(); location.reload(); } });
}

async function initDashboard() {
    const stYear = (localStorage.getItem('drselem_student_year') || '').trim(); const stDept = (localStorage.getItem('drselem_student_dept') || '').trim();
    document.getElementById('display-name').innerText = localStorage.getItem('drselem_student_name'); document.getElementById('display-email').innerText = localStorage.getItem('drselem_student_email'); document.getElementById('display-id').innerText = localStorage.getItem('drselem_student_id'); document.getElementById('display-academic').innerText = `${stYear} - قسم ${stDept}`;
    document.getElementById('loading-screen').style.display = 'flex';
    try {
        const res = await fetch('/api/get-subjects'); const data = await res.json();
        if (data.status === 'error') { document.getElementById('loading-screen').style.display = 'none'; return Swal.fire({icon: 'error', text: data.message, background:'#1a1f2c', color:'#fff'}); }
        const validSubjects = data.subjects.filter(sub => { const subYear = (sub.year || '').trim(); const subDept = (sub.department || '').trim(); if (subYear !== stYear) return false; return subDept === stDept || subDept === 'عام (IT)'; });
        document.getElementById('loading-screen').style.display = 'none'; const container = document.getElementById('subjects-container');
        if (validSubjects.length === 0) container.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open fa-3x" style="color:var(--border); margin-bottom:15px;"></i><h3 style="color:#fff; font-size:16px;">لا توجد مواد متاحة</h3><p style="font-size:13px; margin-top:5px;">لم يتم إضافة أي مقررات تخص فرقتك حتى الآن.</p></div>`;
        else container.innerHTML = validSubjects.map(sub => { let badgeColor = '#3B82F6'; if(sub.department === 'Software') badgeColor = '#10B981'; if(sub.department === 'Network') badgeColor = '#EF4444'; const deptLabel = sub.department && sub.department !== 'عام (IT)' ? ` - ${sub.department}` : ''; const isComplaintsOpen = sub.complaints_open !== false; return `<div class="subject-card" onclick="checkMyID('${sub.id}', '${sub.name}', ${isComplaintsOpen})"><img src="${sub.image}" alt="subject"><h2 class="sub-title">${sub.name}</h2><span class="sub-badge" style="color:${badgeColor};">${sub.year}${deptLabel}</span></div>`}).join('');
    } catch (error) { document.getElementById('loading-screen').style.display = 'none'; Swal.fire({icon: 'error', text: 'حدث خطأ في الاتصال.', background:'#1a1f2c', color:'#fff'}); }
}

async function checkMyID(subId, subName, isComplaintsOpen) {
    const stId = localStorage.getItem('drselem_student_id'), stPass = localStorage.getItem('drselem_student_pass');
    Swal.fire({title: 'جاري البحث...', background:'#1a1f2c', color:'#fff', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch('/api/check-id', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({subject_id: subId, student_id: stId, password: stPass}) }); 
        const data = await res.json();
        
        if (data.status === 'success') {
            if (data.existing_complaint) {
                showExistingComplaintInSubject(data.existing_complaint, subName, isComplaintsOpen);
                return;
            }

            const closedNotice = !isComplaintsOpen ? `<p style="color:#EF4444; font-size:12px; margin-top:10px;"><i class="fas fa-lock"></i> تم إغلاق باب الشكاوى لهذه المادة.</p>` : '';
            Swal.fire({ 
                html: `<i class="fas fa-check-circle fa-3x" style="color:#10B981; margin-bottom:15px;"></i><h2 style="color:var(--gold); font-weight:bold; font-size:18px;">${subName}</h2><div style="background:rgba(16, 185, 129, 0.1); padding:15px; border-radius:12px; border:1px solid #10B981; margin:15px 0;"><p style="color:#10B981; font-size:13px; margin-bottom:5px;">مكان لجنتك هو:</p><h2 style="color:#fff; font-weight:900; font-size:clamp(20px, 6vw, 26px); line-height:1.4;">${data.committee_name}</h2></div>${closedNotice}`, 
                background: '#1a1f2c', 
                showDenyButton: isComplaintsOpen, 
                confirmButtonColor: '#FFB300', 
                confirmButtonText: 'حسناً، شكراً', 
                denyButtonColor: '#EF4444', 
                denyButtonText: 'لدي مشكلة' 
            }).then((result) => { 
                if (result.isDenied && isComplaintsOpen) openWizard(subId, subName, data.committee_name); 
            });
        } else {
            if (data.message.includes("تسجيل الدخول")) Swal.fire({icon: 'error', title: 'تنبيه أمني', text: data.message, background:'#1a1f2c', color:'#fff', confirmButtonText: 'موافق'}).then(() => { localStorage.clear(); location.reload(); });
            else Swal.fire({ icon: 'error', title: 'عفواً', html: `<p style="line-height:1.6; font-size:14px;">رقمك <b style="color:var(--gold); font-family:monospace;">(${stId})</b> غير مسجل في أي لجنة لهذه المادة.<br><span style="font-size:12px; color:var(--text-muted);">يرجى مراجعة الكنترول.</span></p>`, background:'#1a1f2c', color:'#fff', confirmButtonColor: '#EF4444' });
        }
    } catch(e) { Swal.fire({icon: 'error', text: 'حدث خطأ بالشبكة.', background:'#1a1f2c', color:'#fff'}); }
}

function showExistingComplaintInSubject(comp, subName, isComplaintsOpen) {
    let statusBadge = '', replySection = '', actionsHtml = '';

    if (comp.status === 'pending') {
        statusBadge = `<span style="background:rgba(255,179,0,0.1); color:var(--gold); border:1px solid var(--gold); padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;"><i class="fas fa-clock"></i> قيد المراجعة</span>`;
        if (isComplaintsOpen) {
            studentComplaintsData = [comp];
            actionsHtml = `
                <div style="display:flex; gap:10px; margin-top: 15px; width: 100%;">
                    <button class="btn-outline" style="flex:1; padding:10px; border-radius:10px;" onclick="editMyComplaint('${comp.tracking_id}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="btn-danger-outline" style="flex:1; padding:10px; border-radius:10px;" onclick="deleteMyComplaint('${comp.tracking_id}')"><i class="fas fa-trash"></i> حذف</button>
                </div>
            `;
        } else {
            statusBadge = `<span style="background:rgba(239, 68, 68, 0.1); color:#EF4444; border:1px solid #EF4444; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;"><i class="fas fa-lock"></i> قيد المراجعة (مغلق للتعديل)</span>`;
        }
    } else if (comp.status === 'resolved') {
        statusBadge = `<span style="background:rgba(16,185,129,0.1); color:#10B981; border:1px solid #10B981; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;"><i class="fas fa-check-double"></i> تم الرد</span>`;
        replySection = `
            <div style="background:rgba(16, 185, 129, 0.1); border-right:3px solid #10B981; padding:12px; border-radius:8px; margin-top:15px; text-align:right;">
                <p style="color:#10B981; font-weight:bold; font-size:12px; margin-bottom:5px;">رد الإدارة (${comp.replied_by}):</p>
                <p style="color:#fff; font-size:14px; line-height:1.5;">${comp.admin_reply}</p>
            </div>
        `;
    } else if (comp.status === 'spam') {
        statusBadge = `<span style="background:rgba(239,68,68,0.1); color:#EF4444; border:1px solid #EF4444; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;"><i class="fas fa-ban"></i> مرفوضة</span>`;
    }

    const htmlContent = `
        <div style="text-align: right;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border); padding-bottom:10px; margin-bottom:15px;">
                <h2 style="color:var(--gold); font-size:16px; font-weight:bold;">${subName}</h2>
                ${statusBadge}
            </div>
            
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:5px;">نص شكوتاك:</p>
            <div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:8px; color:#E5E7EB; font-size:14px; line-height:1.6;">
                ${comp.problem}
            </div>
            
            ${replySection}
            ${actionsHtml}
        </div>
    `;

    Swal.fire({
        background: '#1a1f2c',
        html: htmlContent,
        showConfirmButton: !actionsHtml,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#4a5568'
    });
}

function openWizard(subId, subName, comName) {
    currentSubId = subId; currentSubName = subName; currentAssignedCom = comName;
    document.getElementById('wiz-readonly-name').innerText = localStorage.getItem('drselem_student_name'); document.getElementById('wiz-readonly-id').innerText = localStorage.getItem('drselem_student_id'); document.getElementById('wiz-dynamic-title').innerText = 'تقديم شكوى - ' + subName; document.getElementById('wiz-assigned-com').innerText = comName; document.getElementById('wiz-sub-name').innerText = subName;
    document.getElementById('wiz-actual-com').value = ''; document.getElementById('wiz-prob').value = ''; updateCharCount(); document.querySelectorAll('input[name="loc"]')[0].checked = true; toggleLocationInput(false);
    document.getElementById('wizard-screen').style.display = 'flex'; goToStep1();
}

function closeWizard() { document.getElementById('wizard-screen').style.display = 'none'; }
function toggleLocationInput(show) { document.getElementById('wiz-actual-com').style.display = show ? 'block' : 'none'; }
function goToStep1() { document.getElementById('step-2').classList.remove('active'); document.getElementById('step-1').classList.add('active'); }
function goToStep2() { const isOther = document.querySelectorAll('input[name="loc"]')[1].checked; const actualLoc = document.getElementById('wiz-actual-com').value; if(isOther && !actualLoc) return Swal.fire({icon: 'warning', text: 'يرجى كتابة المكان الفعلي!', background:'#1a1f2c', color:'#fff'}); document.getElementById('step-1').classList.remove('active'); document.getElementById('step-2').classList.add('active'); }
function updateCharCount() { const len = document.getElementById('wiz-prob').value.length; document.getElementById('char-count').innerText = `${len} / 150`; document.getElementById('char-count').style.color = len >= 150 ? '#EF4444' : '#9CA3AF'; }

async function submitWizard() {
    const prob = document.getElementById('wiz-prob').value; const actualCom = document.querySelectorAll('input[name="loc"]')[1].checked ? document.getElementById('wiz-actual-com').value : currentAssignedCom;
    if(!prob) return Swal.fire({icon: 'warning', text: 'يرجى كتابة الشكوى أولاً.', background:'#1a1f2c', color:'#fff'});
    Swal.fire({title: 'جاري الإرسال...', background:'#1a1f2c', color:'#fff', didOpen: () => Swal.showLoading()});
    try {
        const res = await fetch('/api/submit-complaint', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ subject_id: currentSubId, subject_name: currentSubName, student_id: localStorage.getItem('drselem_student_id'), password: localStorage.getItem('drselem_student_pass'), student_name: localStorage.getItem('drselem_student_name'), assigned_committee: currentAssignedCom, actual_committee: actualCom, problem: prob }) });
        const data = await res.json();
        if(data.status === 'success') { closeWizard(); Swal.fire({ html: `<i class="fas fa-shield-check fa-3x" style="color:var(--gold); margin-bottom:10px;"></i><h2 style="color:#fff; font-size:20px;">تم استلام شكواك بنجاح</h2><p style="color:#9CA3AF; font-size:14px; margin-top:10px;">يمكنك متابعة الرد أو التعديل من خلال الضغط على المادة أو (سجل شكاوي).</p>`, background: '#1a1f2c', confirmButtonColor: '#FFB300', confirmButtonText: 'حسناً' }); } 
        else { if (data.message.includes("تسجيل الدخول")) Swal.fire({icon: 'error', title: 'تنبيه أمني', text: data.message, background:'#1a1f2c', color:'#fff', confirmButtonText: 'موافق'}).then(() => { localStorage.clear(); location.reload(); }); else Swal.fire({icon: 'error', text: data.message, background:'#1a1f2c', color:'#fff'}); }
    } catch (e) { Swal.fire({icon: 'error', text: 'حدث خطأ أثناء الإرسال.', background:'#1a1f2c', color:'#fff'}); }
}

async function openMyComplaints() {
    document.getElementById('loading-screen').style.display = 'flex';
    try {
        const res = await fetch('/api/student-action', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'get_complaints', student_id: localStorage.getItem('drselem_student_id'), password: localStorage.getItem('drselem_student_pass') }) });
        const data = await res.json(); document.getElementById('loading-screen').style.display = 'none';
        if (data.status === 'success') { renderMyComplaints(data.complaints); document.getElementById('complaints-screen').style.display = 'flex'; } 
        else { if (data.message.includes("تسجيل الدخول")) Swal.fire({icon: 'error', title: 'تنبيه أمني', text: data.message, background:'#1a1f2c', color:'#fff', confirmButtonText: 'موافق'}).then(() => { localStorage.clear(); location.reload(); }); else Swal.fire({icon: 'error', text: data.message, background:'#1a1f2c', color:'#fff'}); }
    } catch(e) { document.getElementById('loading-screen').style.display = 'none'; Swal.fire({icon: 'error', text: 'خطأ في الاتصال بالخادم.', background:'#1a1f2c', color:'#fff'}); }
}

function closeMyComplaints() { document.getElementById('complaints-screen').style.display = 'none'; }

function renderMyComplaints(complaints) {
    studentComplaintsData = complaints; 
    const container = document.getElementById('complaints-list-container');
    
    if (!complaints || complaints.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-box-open fa-3x" style="color:var(--border); margin-bottom:15px;"></i><h3 style="color:#fff; font-size:16px;">لا توجد شكاوى</h3><p style="font-size:13px; margin-top:5px;">لم تقم بتقديم أي شكوى حتى الآن.</p></div>`;
        return;
    }

    container.innerHTML = complaints.map(c => {
        let statusBadge, actionBtn = '', replySection = '';
        
        if (c.status === 'pending') {
            if (c.is_open !== false) {
                statusBadge = `<span class="badge-pending"><i class="fas fa-clock"></i> قيد المراجعة</span>`;
                actionBtn = `<div style="display:flex; gap:8px;"><button class="btn-outline" style="padding:4px 10px; font-size:11px;" onclick="editMyComplaint('${c.tracking_id}')"><i class="fas fa-edit"></i> تعديل</button><button class="btn-danger-outline" style="padding:4px 10px; font-size:11px;" onclick="deleteMyComplaint('${c.tracking_id}')"><i class="fas fa-trash"></i> حذف</button></div>`;
            } else {
                statusBadge = `<span class="badge-pending" style="background:rgba(239, 68, 68, 0.1); color:#EF4444; border-color:#EF4444;"><i class="fas fa-lock"></i> قيد المراجعة (مغلق للتعديل)</span>`;
                actionBtn = ``; 
            }
        } else if (c.status === 'resolved') {
            statusBadge = `<span class="badge-resolved"><i class="fas fa-check-double"></i> تم الرد</span>`;
            replySection = `<div class="comp-reply"><p style="color:#10B981; font-weight:bold; font-size:12px; margin-bottom:5px;">رد الإدارة (${c.replied_by}):</p><p style="color:#fff; font-size:14px; line-height:1.5;">${c.admin_reply}</p></div>`;
        } else if (c.status === 'spam') {
            statusBadge = `<span class="badge-spam"><i class="fas fa-ban"></i> مرفوضة</span>`;
        }

        return `<div class="comp-card"><div class="comp-header"><div><span class="comp-sub">${c.subject_name}</span></div>${statusBadge}</div><div style="display:flex; justify-content:flex-end; align-items:center;">${actionBtn}</div><div class="comp-prob"><strong style="color:var(--text-muted); font-size:12px;">نص الشكوى:</strong><br>${c.problem}</div>${replySection}</div>`;
    }).join('');
}

async function editMyComplaint(trackingId) {
    const comp = studentComplaintsData.find(c => c.tracking_id === trackingId);
    if (!comp) return;
    const oldProblem = comp.problem;

    const htmlContent = `
        <div style="text-align: right;">
            <h2 style="color:#fff; text-align:center; margin-bottom:15px; font-size: 18px;">
                <i class="fas fa-edit" style="color:var(--gold);"></i> تفاصيل الشكوى
            </h2>
            <p style="color:var(--gold); font-size:14px; margin-bottom:12px; font-weight:bold;">
                المادة: <span style="color:#fff;">${comp.subject_name}</span>
            </p>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:10px;">
                اكتب مشكلتك باختصار (بحد أقصى 150 حرف):
            </p>
            
            <textarea id="swal-edit-prob" class="input-dark" style="height:110px; resize:none; width: 100%; box-sizing: border-box;" maxlength="150" placeholder="مثال: لم أجد درجاتي مسجلة...">${oldProblem}</textarea>
            
            <div id="swal-char-count" style="text-align: left; font-size: 12px; color: ${oldProblem.length >= 150 ? '#EF4444' : '#9CA3AF'}; margin-top: -10px; margin-bottom: 15px; font-family: monospace; font-weight:bold;">
                ${oldProblem.length} / 150
            </div>
        </div>
    `;

    const { value: newProblem } = await Swal.fire({
        background: '#1a1f2c',
        html: htmlContent,
        showCancelButton: true,
        buttonsStyling: false,
        confirmButtonText: 'تحديث الشكوى <i class="fas fa-save"></i>',
        cancelButtonText: '<i class="fas fa-arrow-right"></i> رجوع',
        didOpen: () => {
            const textarea = document.getElementById('swal-edit-prob');
            const counter = document.getElementById('swal-char-count');
            
            const actions = Swal.getActions();
            actions.style.display = 'flex';
            actions.style.gap = '10px';
            actions.style.width = '100%';
            actions.style.padding = '0';
            
            const confirmBtn = Swal.getConfirmButton();
            confirmBtn.className = 'btn-primary';
            confirmBtn.style.margin = '0';
            
            const cancelBtn = Swal.getCancelButton();
            cancelBtn.className = 'btn-secondary';
            cancelBtn.style.margin = '0';

            textarea.addEventListener('input', () => {
                const len = textarea.value.length;
                counter.innerText = `${len} / 150`;
                counter.style.color = len >= 150 ? '#EF4444' : '#9CA3AF';
            });
        },
        preConfirm: () => {
            const val = document.getElementById('swal-edit-prob').value;
            if (!val.trim()) {
                Swal.showValidationMessage('يرجى كتابة الشكوى أولاً!');
                return false;
            }
            return val;
        }
    });
    
    if (newProblem && newProblem.trim() !== oldProblem.trim()) {
        Swal.fire({title: 'جاري التحديث...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            const res = await fetch('/api/student-action', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ 
                    action: 'edit_complaint', 
                    student_id: localStorage.getItem('drselem_student_id'), 
                    password: localStorage.getItem('drselem_student_pass'), 
                    tracking_id: trackingId, 
                    new_problem: newProblem 
                }) 
            });
            const data = await res.json();
            if (data.status === 'success') { 
                Swal.fire({icon: 'success', title: 'تم التحديث بنجاح!', background: '#1a1f2c', color: '#fff', timer: 1500, showConfirmButton: false}).then(() => {
                    // إغلاق أي نوافذ مفتوحة لو كنا بنعدل من شاشة المادة الذكية
                    Swal.close(); 
                    // لو نافذة السجل مفتوحة يتم تحديثها
                    if(document.getElementById('complaints-screen').style.display === 'flex') openMyComplaints();
                }); 
            } 
            else { 
                if (data.message.includes("تسجيل الدخول")) {
                    Swal.fire({icon: 'error', title: 'تنبيه أمني', text: data.message, background:'#1a1f2c', color:'#fff', confirmButtonText: 'موافق'}).then(() => { localStorage.clear(); location.reload(); }); 
                } else {
                    Swal.fire({icon: 'error', text: data.message, background: '#1a1f2c', color: '#fff'}); 
                }
            }
        } catch(e) { Swal.fire({icon: 'error', text: 'خطأ في الاتصال بالخادم.', background: '#1a1f2c', color: '#fff'}); }
    }
}

async function deleteMyComplaint(trackingId) {
    const { isConfirmed } = await Swal.fire({ ...swalDark, title: 'تأكيد الحذف', text: 'هل أنت متأكد من حذف هذه الشكوى؟', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء' });
    if (isConfirmed) {
        Swal.fire({title: 'جاري الحذف...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            const res = await fetch('/api/student-action', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'delete_complaint', student_id: localStorage.getItem('drselem_student_id'), password: localStorage.getItem('drselem_student_pass'), tracking_id: trackingId }) });
            const data = await res.json();
            if (data.status === 'success') { 
                Swal.fire({...swalDark, icon: 'success', title: 'تم الحذف بنجاح!', timer: 1500, showConfirmButton: false}).then(() => {
                    Swal.close();
                    if(document.getElementById('complaints-screen').style.display === 'flex') openMyComplaints();
                });
            } 
            else { if (data.message.includes("تسجيل الدخول")) Swal.fire({icon: 'error', title: 'تنبيه أمني', text: data.message, background:'#1a1f2c', color:'#fff', confirmButtonText: 'موافق'}).then(() => { localStorage.clear(); location.reload(); }); else Swal.fire({...swalDark, icon: 'error', text: data.message}); }
        } catch(e) { Swal.fire({...swalDark, icon: 'error', text: 'خطأ في الاتصال بالخادم.'}); }
    }
}