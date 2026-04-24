// ==========================================
// Shared Settings & Variables (Admin)
// ==========================================
const swalDark = { background: '#1F2937', color: '#fff', confirmButtonColor: '#FFB300' };

let me = null;
let globalSubjects = [];
let globalCommittees = [];
let fullComplaints = [];
let globalStaff = [];
let globalStudents = [];
let tempSelectedTA = null;
let tempAvailableTAs = [];

let committeeFilter = JSON.parse(localStorage.getItem('admin_committee_filter')) || { sub: '' };
let activeSubjectsFilter = 'all';
let activeStudentsFilter = 'all';

let compFilters = JSON.parse(localStorage.getItem('admin_comp_filters')) || {
    'pending': { sub: '', com: 'all' },
    'resolved': { sub: '', com: 'all' },
    'spam': { sub: '', com: 'all' }
};

// ==========================================
// Window Onload Dispatcher (Admin)
// ==========================================
window.onload = async () => {
    refreshData();
};

// ==========================================
// Admin Functions
// ==========================================
async function changeMyPassword() {
    const { value: formValues } = await Swal.fire({
        ...swalDark,
        title: 'تغيير كلمة المرور الخاصة بي',
        html: `<input id="new-pw" type="password" class="login-input ltr-input" placeholder="New Password">`,
        preConfirm: () => {
            const pw = document.getElementById('new-pw').value;
            if(!pw || pw.trim() === '') return Swal.showValidationMessage('يجب إدخال كلمة مرور جديدة');
            return pw;
        }
    });

    if(formValues) {
        Swal.fire({title: 'جاري التحديث...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            const data = await postAdminAction({action: 'change_my_password', new_password: formValues});
            if(data.status === 'success') {
                Swal.fire({...swalDark, icon: 'success', title: 'تم تغيير كلمة المرور بنجاح!', timer: 1500, showConfirmButton: false});
            } else {
                Swal.fire({...swalDark, icon: 'error', text: data.message});
            }
        } catch(e) {}
    }
}

async function postAdminAction(bodyData) {
    const res = await fetch('/api/admin-action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(bodyData)
    });
    const data = await res.json();
    if (res.status === 401 || data.status === 'unauthorized') {
        Swal.fire({icon: 'error', title: 'تنبيه أمني', text: data.message || 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً.', background:'#1a1f2c', color:'#fff'}).then(() => {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('main-app').style.display = 'none';
        });
        throw new Error("Unauthorized");
    }
    return data;
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    sidebar.classList.toggle('open');
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}

async function handleLogin() {
    const userVal = document.getElementById('user').value.trim();
    const passVal = document.getElementById('pass').value.trim();
    if(!userVal || !passVal) {
        return Swal.fire({...swalDark, icon: 'warning', text: 'الرجاء إدخال اسم المستخدم وكلمة المرور'});
    }
    Swal.fire({title: 'جاري التحقق...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
    
    const res = await fetch('/auth-gateway-vip-x9v2-pL7q-2026', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({username: userVal, password: passVal})
    });
    const data = await res.json();
    
    if(data.status === 'success') {
        Swal.close();
        document.getElementById('user').value = '';
        document.getElementById('pass').value = '';
        refreshData(); 
    } else {
        Swal.fire({...swalDark, icon: 'error', text: data.message});
    }
}

async function refreshData() {
    const res = await fetch('/api/admin-data');
    const data = await res.json();
    
    if (res.status === 401 || data.status === 'unauthorized' || !data.currentAdmin) {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
        if (data.message) {
            Swal.fire({icon: 'error', title: 'تنبيه أمني', text: data.message, background:'#1a1f2c', color:'#fff'});
        }
        return;
    }

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';

    me = data.currentAdmin;
    globalSubjects = data.subjects || [];
    globalCommittees = data.committees || [];
    fullComplaints = data.complaints || [];
    globalStaff = data.staff || [];
    globalStudents = data.students || [];
    
    const yearOrder = {
        "الفرقة الأولى": 1,
        "الفرقة الثانية": 2,
        "الفرقة الثالثة": 3,
        "الفرقة الرابعة": 4
    };
    
    globalSubjects.sort((a, b) => {
        const yearA = yearOrder[a.year] || 99;
        const yearB = yearOrder[b.year] || 99;
        if (yearA !== yearB) return yearA - yearB;
        return (a.department || '').localeCompare(b.department || '', 'ar');
    });
    
    let roleBadge = '';
    if(me.role === 'super_admin') roleBadge = '<span style="color:var(--gold); font-size:12px; background:#000; padding:2px 8px; border-radius:10px;">الآدمن الرئيسي</span>';
    else if(me.role === 'doctor') roleBadge = '<span style="color:#10B981; font-size:12px; background:#000; padding:2px 8px; border-radius:10px;">دكتور مادة</span>';
    else roleBadge = '<span style="color:#3B82F6; font-size:12px; background:#000; padding:2px 8px; border-radius:10px;">معيد</span>';
    
    document.getElementById('welcome-text').innerHTML = `مرحباً، ${me.name} ${roleBadge}`;

    if(me.role !== 'super_admin') document.querySelectorAll('.super-only').forEach(e => e.style.display = 'none');
    if(me.role === 'ta') document.querySelectorAll('.staff-manager-only').forEach(e => e.style.display = 'none');

    if(me.role === 'super_admin' || me.role === 'doctor') {
        let visibleStaff = globalStaff;
        if (me.role === 'doctor') {
            visibleStaff = globalStaff.filter(s => s.allowed_subjects && s.allowed_subjects.length > 0);
        }

        document.getElementById('staff-list').innerHTML = visibleStaff.map(s => {
            let allowedNames = '-';
            if (s.allowed_subjects && s.allowed_subjects.length > 0) {
                allowedNames = s.allowed_subjects.map(subId => {
                    let fSub = globalSubjects.find(gs => gs.id === subId);
                    return fSub ? `<span style="background:rgba(255, 179, 0, 0.1); color:var(--gold); padding:2px 6px; border-radius:4px; font-size:11px; margin:2px; display:inline-block;">${fSub.name}</span>` : '';
                }).join('');
            }
            
            let roleStr = s.role === 'doctor' ? '<i class="fas fa-user-tie" style="color:#10B981"></i> دكتور مادة' : '<i class="fas fa-user-graduate" style="color:#3B82F6"></i> معيد';

            return `
                <tr>
                    <td style="font-weight:bold;">${s.name}</td>
                    <td style="font-family:monospace; color:var(--text-muted);">${s.username}</td>
                    <td style="line-height:1.8;">${allowedNames || 'بدون صلاحيات'}</td>
                    <td>${roleStr}</td>
                    <td>
                        <div style="display:flex; justify-content:center; gap:5px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-gold" onclick="editStaff('${s.username}')"><i class="fas fa-edit"></i> تعديل</button>
                            <button type="button" class="btn btn-red" onclick="deleteAction('manage_staff', '${s.username}', true)"><i class="fas fa-trash"></i> حذف</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');            
    }
    
    if(globalSubjects.length > 0) {
        if(!committeeFilter.sub || !globalSubjects.find(s=>s.id===committeeFilter.sub)) committeeFilter.sub = globalSubjects[0].id;
        ['pending', 'resolved', 'spam'].forEach(tab => {
            if(!compFilters[tab].sub || !globalSubjects.find(s=>s.id===compFilters[tab].sub)) compFilters[tab].sub = globalSubjects[0].id;
        });
        saveAllFilters();
    }

    renderSubjectsTable();
    if(me.role === 'super_admin') renderStudentsTable();
    buildSidebarMenus();
    renderCommittees();
    renderComplaints('pending');
    renderComplaints('resolved');
    renderComplaints('spam');

    if(!document.querySelector('.content-section.active')) {
        document.getElementById('tab-pending').click();
    }
}

function filterSubjectsTab(filterValue, btnEl) {
    activeSubjectsFilter = filterValue;
    document.querySelectorAll('#subject-nav-filters .com-btn').forEach(btn => btn.classList.remove('active'));
    if(btnEl) btnEl.classList.add('active');
    renderSubjectsTable();
}

function renderSubjectsTable() {
    let filteredSubs = globalSubjects;

    if (activeSubjectsFilter !== 'all') {
        if(activeSubjectsFilter.includes('_')) {
            const parts = activeSubjectsFilter.split('_');
            const targetYear = parts[0];
            const targetDept = parts[1];
            filteredSubs = globalSubjects.filter(s => s.year === targetYear && (s.department === targetDept || s.department === 'عام (IT)'));
        } else {
            filteredSubs = globalSubjects.filter(s => s.year === activeSubjectsFilter);
        }
    }

    if(filteredSubs.length === 0) {
        document.getElementById('subjects-list').innerHTML = `<tr><td colspan="5" style="color:var(--text-muted); padding:30px;">لا توجد مواد مضافة في هذا القسم.</td></tr>`;
        return;
    }

    document.getElementById('subjects-list').innerHTML = filteredSubs.map(s => {
        let deptColor = '#3B82F6';
        let bgDeptColor = 'rgba(59, 130, 246, 0.2)';
        if (s.department === 'Software') { deptColor = '#10B981'; bgDeptColor = 'rgba(16, 185, 129, 0.2)'; }
        else if (s.department === 'Network') { deptColor = '#EF4444'; bgDeptColor = 'rgba(239, 68, 68, 0.2)'; }

        return `
        <tr>
            <td><img src="${s.image}" width="35" style="border-radius:6px; background:#fff; padding:2px;"></td>
            <td style="color:var(--gold); font-weight:bold; font-size:15px;">${s.name}</td>
            <td>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <span style="color:#fff; font-size:12px; font-weight:bold;">${s.year || '-'}</span>
                    <span style="background:${bgDeptColor}; color:${deptColor}; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:bold; white-space:nowrap;">${s.department || '-'}</span>
                </div>
            </td>
            <td style="color:var(--text-muted); font-size:12px;">${s.added_by}</td>
            <td>${me.role === 'super_admin' ? `<div style="display:flex; justify-content:center; gap:5px; flex-wrap:wrap;"><button type="button" class="btn btn-gold" onclick="editSubject('${s.id}')"><i class="fas fa-edit"></i> تعديل</button><button type="button" class="btn btn-red" onclick="executeDelete('manage_subject', '${s.id}')"><i class="fas fa-trash"></i> حذف</button></div>` : '-'}</td>
        </tr>
    `}).join('');
}

function filterStudentsTab(filterValue, btnEl) {
    activeStudentsFilter = filterValue;
    document.querySelectorAll('#student-nav-filters .com-btn').forEach(btn => btn.classList.remove('active'));
    if(btnEl) btnEl.classList.add('active');
    renderStudentsTable();
}

function renderStudentsTable() {
    let filteredStudents = globalStudents;

    if (activeStudentsFilter !== 'all') {
        if(activeStudentsFilter.includes('_')) {
            const parts = activeStudentsFilter.split('_');
            const targetYear = parts[0];
            const targetDept = parts[1];
            filteredStudents = globalStudents.filter(s => s.year === targetYear && (s.department === targetDept || s.department === 'عام (IT)'));
        } else {
            filteredStudents = globalStudents.filter(s => s.year === activeStudentsFilter);
        }
    }

    if(filteredStudents.length === 0) {
        document.getElementById('students-list').innerHTML = `<tr><td colspan="5" style="color:var(--text-muted); padding:30px;">لا توجد حسابات طلاب مضافة في هذا القسم.</td></tr>`;
        return;
    }

    document.getElementById('students-list').innerHTML = filteredStudents.map(s => {
        let deptColor = '#3B82F6';
        let bgDeptColor = 'rgba(59, 130, 246, 0.2)';
        if (s.department === 'Software') { deptColor = '#10B981'; bgDeptColor = 'rgba(16, 185, 129, 0.2)'; }
        else if (s.department === 'Network') { deptColor = '#EF4444'; bgDeptColor = 'rgba(239, 68, 68, 0.2)'; }

        return `
        <tr>
            <td style="color:var(--gold); font-weight:bold; font-size:14px;">${s.name}</td>
            <td dir="ltr" style="font-family:monospace; font-weight:bold; color:var(--text-muted); font-size:13px;">${s.student_id}@batechu.com</td>
            <td>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <span style="color:#fff; font-size:12px; font-weight:bold;">${s.year || '-'}</span>
                    <span style="background:${bgDeptColor}; color:${deptColor}; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:bold; white-space:nowrap;">${s.department || '-'}</span>
                </div>
            </td>
            <td style="font-family:monospace; color:#10B981;">${s.password}</td>
            <td>
                <div style="display:flex; justify-content:center; gap:5px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-gold" onclick="editStudent('${s.student_id}')"><i class="fas fa-edit"></i> تعديل</button>
                    <button type="button" class="btn btn-red" onclick="executeDelete('manage_student', '${s.student_id}', false)"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </td>
        </tr>
    `}).join('');
}

async function addStudentsBulk() {
    let defaultYear = "";
    let defaultDept = "عام (IT)";
    if (activeStudentsFilter !== 'all') {
        if (activeStudentsFilter.includes('_')) {
            const parts = activeStudentsFilter.split('_');
            defaultYear = parts[0];
            defaultDept = parts[1];
        } else {
            defaultYear = activeStudentsFilter;
        }
    }
    
    let yearOpts = `<option value="" disabled ${!defaultYear ? "selected" : ""}>اختر الفرقة الدراسية</option>`;
    ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة"].forEach(y => {
        yearOpts += `<option value="${y}" ${defaultYear === y ? "selected" : ""}>${y}</option>`;
    });
    
    let deptOpts = "";
    if (defaultYear === 'الفرقة الثالثة' || defaultYear === 'الفرقة الرابعة') {
        deptOpts += `<option value="عام (IT)" ${defaultDept === 'عام (IT)' ? 'selected' : ''}>عام (IT)</option>`;
        deptOpts += `<option value="Software" ${defaultDept === 'Software' ? 'selected' : ''}>Software</option>`;
        deptOpts += `<option value="Network" ${defaultDept === 'Network' ? 'selected' : ''}>Network</option>`;
    } else {
        deptOpts = `<option value="عام (IT)" selected>عام (IT)</option>`;
    }

    const { value: formValues } = await Swal.fire({ 
        ...swalDark, title: 'إضافة حسابات الطلاب', 
        html: `<select id="bulk-year" class="login-input" style="background:#000;">${yearOpts}</select><select id="bulk-dept" class="login-input" style="background:#000;">${deptOpts}</select><p style="text-align:right; font-size:12px; color:var(--text-muted); margin-bottom:5px;">الصق البيانات (كل طالب في سطر) بهذا الترتيب:<br><b style="color:var(--gold);">الاسم, ID, الباسورد</b></p><textarea id="bulk-raw" class="login-input ltr-input" style="height:180px;" placeholder="أحمد محمد, 2220034, pass123\nعلي محمود, 2220035, pass456"></textarea>`, 
        didOpen: () => {
            document.getElementById('bulk-year').addEventListener('change', (e) => {
                const deptSelect = document.getElementById('bulk-dept');
                if (e.target.value === 'الفرقة الثالثة' || e.target.value === 'الفرقة الرابعة') deptSelect.innerHTML = '<option value="عام (IT)">عام (IT)</option><option value="Software">Software</option><option value="Network">Network</option>';
                else deptSelect.innerHTML = '<option value="عام (IT)">عام (IT)</option>';
            });
        },
        preConfirm: () => { 
            const year = document.getElementById('bulk-year').value, dept = document.getElementById('bulk-dept').value, raw = document.getElementById('bulk-raw').value; 
            if(!year || !dept || !raw) return Swal.showValidationMessage('يرجى استكمال جميع البيانات وإدخال بيانات الطلاب!'); 
            return { year: year, dept: dept, raw_data: raw }; 
        } 
    });
    
    if(formValues) { 
        Swal.fire({title: 'جاري إنشاء الحسابات...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()}); 
        try {
            const data = await postAdminAction({action:'manage_student', sub:'add_bulk', ...formValues}); 
            if(data.status === 'error') Swal.fire({...swalDark, icon: 'error', text: data.message});
            else { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: data.message, timer: 2000, showConfirmButton: false});}
        } catch(e) {}
    }
}

async function editStudent(studentId) {
    const student = globalStudents.find(s => s.student_id === studentId);
    if (!student) return;

    let yearOpts = "";
    ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة"].forEach(y => { yearOpts += `<option value="${y}" ${student.year === y ? "selected" : ""}>${y}</option>`; });
    let deptOpts = "";
    if (student.year === 'الفرقة الثالثة' || student.year === 'الفرقة الرابعة') {
        deptOpts += `<option value="عام (IT)" ${student.department === 'عام (IT)' ? 'selected' : ''}>عام (IT)</option><option value="Software" ${student.department === 'Software' ? 'selected' : ''}>Software</option><option value="Network" ${student.department === 'Network' ? 'selected' : ''}>Network</option>`;
    } else deptOpts = `<option value="عام (IT)" selected>عام (IT)</option>`;

    const formHtml = `<input id="est-name" class="login-input" placeholder="اسم الطالب" value="${student.name}"><input id="est-id" class="login-input ltr-input" placeholder="Student ID" value="${student.student_id}"><input id="est-pass" class="login-input ltr-input" placeholder="Password" value="${student.password}"><select id="est-year" class="login-input" style="background:#000;">${yearOpts}</select><select id="est-dept" class="login-input" style="background:#000;">${deptOpts}</select>`;

    const { value: formValues } = await Swal.fire({
        ...swalDark, title: 'تعديل بيانات الطالب', html: formHtml,
        didOpen: () => {
            document.getElementById('est-year').addEventListener('change', (e) => {
                const deptSelect = document.getElementById('est-dept');
                if (e.target.value === 'الفرقة الثالثة' || e.target.value === 'الفرقة الرابعة') deptSelect.innerHTML = '<option value="عام (IT)">عام (IT)</option><option value="Software">Software</option><option value="Network">Network</option>';
                else deptSelect.innerHTML = '<option value="عام (IT)">عام (IT)</option>';
            });
        },
        preConfirm: () => {
            const name = document.getElementById('est-name').value, s_id = document.getElementById('est-id').value, pass = document.getElementById('est-pass').value, year = document.getElementById('est-year').value, dept = document.getElementById('est-dept').value;
            if (!name || !s_id || !pass) return Swal.showValidationMessage('جميع الحقول مطلوبة');
            if (s_id.length !== 7 || !/^\d+$/.test(s_id)) return Swal.showValidationMessage('الـ ID يجب أن يكون 7 أرقام فقط');
            return { old_id: student.student_id, name: name, student_id: s_id, password: pass, year: year, dept: dept };
        }
    });

    if (formValues) {
        Swal.fire({title: 'جاري الحفظ...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            const data = await postAdminAction({action: 'manage_student', sub: 'edit', ...formValues});
            if(data.status === 'error') Swal.fire({...swalDark, icon: 'error', text: data.message});
            else { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم التعديل بنجاح!', timer: 1500, showConfirmButton: false});}
        } catch(e) {}
    }
}

async function wipeStudentsFilter() {
    if (activeStudentsFilter === 'all') return Swal.fire({...swalDark, icon: 'info', text: 'يرجى تحديد فرقة دراسية معينة لمسحها (لا يمكن مسح الكل من هنا للوقاية من الأخطاء).'});
    let filterYear = "", filterDept = "عام (IT)";
    if (activeStudentsFilter.includes('_')) { const parts = activeStudentsFilter.split('_'); filterYear = parts[0]; filterDept = parts[1]; } 
    else { filterYear = activeStudentsFilter; }

    const { isConfirmed } = await Swal.fire({...swalDark, title: 'تأكيد المسح؟', text: `هل أنت متأكد من مسح جميع حسابات طلاب (${filterYear} - ${filterDept}) نهائياً؟`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'نعم، امسح', cancelButtonText: 'إلغاء' });
    if (isConfirmed) {
        Swal.fire({title: 'جاري المسح...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            await postAdminAction({action: 'manage_student', sub: 'wipe_filter', year: filterYear, dept: filterDept});
            await refreshData();
            Swal.fire({...swalDark, icon: 'success', title: 'تم مسح طلاب هذه الدفعة بنجاح!', timer: 1500, showConfirmButton: false});
        } catch(e) {}
    }
}

function saveAllFilters() {
    localStorage.setItem('admin_committee_filter', JSON.stringify(committeeFilter));
    localStorage.setItem('admin_comp_filters', JSON.stringify(compFilters));
}

function toggleSubMenu(tabName, el) {
    const allTabs = ['committees', 'pending', 'resolved', 'spam', 'students'];
    allTabs.forEach(t => {
        if(t !== tabName) {
            const menu = document.getElementById(`menu-${t}`);
            if(menu) menu.classList.remove('open');
            const tab = document.getElementById(`tab-${t}`);
            if(tab) tab.classList.remove('open-menu', 'active');
        }
    });
    
    const tgtMenu = document.getElementById(`menu-${tabName}`);
    if(tgtMenu) tgtMenu.classList.toggle('open');
    if(el) { el.classList.toggle('open-menu'); el.classList.add('active'); }

    document.querySelectorAll('.content-section').forEach(t => t.classList.remove('active'));
    let contentId = tabName.startsWith('complaints-') ? tabName : `complaints-${tabName}`;
    if (tabName === 'committees') contentId = 'committees';
    if (tabName === 'students') contentId = 'students';
    const tgtContent = document.getElementById(contentId);
    if(tgtContent) tgtContent.classList.add('active');
}

function buildSidebarMenus() {
    const tabs = ['committees', 'pending', 'resolved', 'spam'];
    tabs.forEach(tab => {
        const menu = document.getElementById(`menu-${tab}`);
        if (!menu) return;
        let html = '';
        globalSubjects.forEach(s => {
            let activeCls = '', clickHandler = '';
            if (tab === 'committees') { activeCls = committeeFilter.sub === s.id ? 'active' : ''; clickHandler = `filterCommitteesBySubject('${s.id}', this)`; } 
            else { activeCls = compFilters[tab].sub === s.id ? 'active' : ''; clickHandler = `filterComplaintsBySubject('${s.id}', '${tab}', this)`; }
            const deptStr = s.department === 'عام (IT)' ? '' : ` - ${s.department}`;
            const displayName = `${s.name} <br><span style="font-size:10px; color:#6B7280; font-weight:normal;">(${s.year}${deptStr})</span>`;
            html += `<li class="${activeCls}" onclick="${clickHandler}" style="display:block;">${displayName}</li>`;
        });
        menu.innerHTML = html;
    });
}

function filterCommitteesBySubject(subId, el) {
    committeeFilter.sub = subId; saveAllFilters();
    document.querySelectorAll('#menu-committees li').forEach(li => li.classList.remove('active'));
    if(el && el.tagName === 'LI') el.classList.add('active');
    if(window.innerWidth <= 1024) toggleSidebar();
    renderCommittees();
}

function renderCommittees() {
    const activeSub = committeeFilter.sub;
    const subjectObj = globalSubjects.find(s => s.id === activeSub);
    const sName = subjectObj?.name || '...';
    const sDetails = subjectObj ? `(${subjectObj.year} - ${subjectObj.department})` : '';
    const list = globalCommittees.filter(c => c.subject_id === activeSub);
    const totalStudents = list.reduce((sum, c) => sum + (c.ids ? c.ids.length : 0), 0);
    
    document.getElementById('committees-title').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%;">
            <div style="font-size:16px; color:var(--gold); font-weight:bold;"><i class="fas fa-layer-group"></i> قوائم اللجان - مادة: <span style="color:#fff;">${sName} <span style="font-size:12px;color:var(--text-muted);">${sDetails}</span></span> <span style="display:inline-block; margin-top:5px; color:var(--gold); border:1px solid var(--gold); background:rgba(255,179,0,0.1); padding:4px 10px; border-radius:12px; font-size:12px; margin-right:5px; font-weight:bold;">(${list.length} لجان / ${totalStudents} طالب)</span></div>
            ${me.role === 'super_admin' && activeSub && list.length > 0 ? `<button type="button" class="btn btn-red" onclick="wipeSubjectCommittees('${activeSub}')"><i class="fas fa-trash-alt"></i> مسح جميع لجان المادة</button>` : ''}
        </div>
    `;

    const tbody = document.getElementById('committees-list');
    if (list.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted); padding:30px;">لا توجد لجان مضافة لهذه المادة بعد.</td></tr>`; return; }
    tbody.innerHTML = list.map(c => `<tr><td style="color:#10B981; font-weight:bold;">${c.committee_name}</td><td><span style="background:rgba(16,185,129,0.1); color:#10B981; padding:6px 12px; border-radius:8px;"><span style="font-size:18px; font-weight:900; color:#fff;">${c.ids.length}</span> طالب</span></td><td>${c.added_by}</td><td><div style="display:flex; justify-content:center; gap:5px; flex-wrap:wrap;"><button type="button" class="btn btn-gold" onclick="editCommittee('${c.committee_id}')"><i class="fas fa-edit"></i> تعديل</button><button type="button" class="btn btn-red" onclick="executeDelete('manage_committee', '${c.committee_id}')"><i class="fas fa-trash"></i> حذف</button></div></td></tr>`).join('');
}

async function wipeSubjectCommittees(subId) {
    if(!subId) return;
    const { isConfirmed } = await Swal.fire({...swalDark, title: 'تأكيد المسح؟', text: 'سيتم مسح جميع اللجان التابعة لهذه المادة نهائياً!', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'نعم، امسح الكل', cancelButtonText: 'إلغاء' });
    if(isConfirmed) {
        Swal.fire({title: 'جاري المسح...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            await postAdminAction({action: 'wipe_subject_committees', subject_id: subId});
            await refreshData();
            Swal.fire({...swalDark, icon: 'success', title: 'تم المسح بنجاح!', timer: 1500, showConfirmButton: false});
        } catch(e) {}
    }
}

async function editCommittee(comId) {
    const com = globalCommittees.find(c => c.committee_id === comId);
    if (!com) return;
    const rawIdsStr = com.ids.join('\n');
    const { value: v } = await Swal.fire({ 
        ...swalDark, title: 'تعديل بيانات اللجنة', 
        html: `<input id="ecom-name" class="login-input" placeholder="اسم المدرج/اللجنة" value="${com.committee_name}"><p style="text-align:right; font-size:12px; color:var(--text-muted);">قائمة الـ IDs (كل رقم في سطر):</p><textarea id="ecom-raw" class="login-input ltr-input" style="height:150px;">${rawIdsStr}</textarea>`, 
        preConfirm: () => { const name = document.getElementById('ecom-name').value; const raw = document.getElementById('ecom-raw').value; if(!name || !raw) return Swal.showValidationMessage('بيانات ناقصة'); return { committee_id: com.committee_id, name: name, raw_ids: raw }; } 
    });
    
    if(v) { 
        Swal.fire({title: 'جاري الحفظ...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()}); 
        try { await postAdminAction({action:'manage_committee', sub:'edit', committee:v}); await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم التعديل بنجاح!', timer: 1500, showConfirmButton: false}); } catch(e) {}
    }
}

function filterComplaintsBySubject(subId, tabName, el) {
    compFilters[tabName].sub = subId; compFilters[tabName].com = 'all'; saveAllFilters();
    document.querySelectorAll(`#menu-${tabName} li`).forEach(li => li.classList.remove('active'));
    el.classList.add('active'); if(window.innerWidth <= 1024) toggleSidebar(); renderComplaints(tabName);
}

function filterCommittee(comName, tabName) { compFilters[tabName].com = comName; saveAllFilters(); renderComplaints(tabName); }

function renderComplaints(tabName) {
    const activeSub = compFilters[tabName].sub; const activeCom = compFilters[tabName].com;
    let list = fullComplaints.filter(c => c.status === tabName);
    if(activeSub) list = list.filter(c => c.subject_id === activeSub);
    const totalInSubject = list.length; 
    if(activeCom !== 'all') list = list.filter(c => c.assigned_committee === activeCom || (c.actual_committee && c.actual_committee === activeCom));
    
    const subjectObj = globalSubjects.find(s => s.id === activeSub); const sName = subjectObj?.name || ''; const isComplaintsOpen = subjectObj ? (subjectObj.complaints_open !== false) : true;
    const titles = { 'pending': 'الشكاوى الجديدة', 'resolved': 'الشكاوى المجاب عليها', 'spam': 'الشكاوى المرفوضة' };
    const icons = { 'pending': 'fa-inbox', 'resolved': 'fa-check-double', 'spam': 'fa-ban' };
    const colors = { 'pending': 'var(--gold)', 'resolved': '#10B981', 'spam': '#EF4444' };
    const badgeColors = { 'pending': 'color:var(--gold); border:1px solid var(--gold); background:rgba(255,179,0,0.1);', 'resolved': 'color:#10B981; border:1px solid #10B981; background:rgba(16,185,129,0.1);', 'spam': 'color:#EF4444; border:1px solid #EF4444; background:rgba(239,68,68,0.1);' };
    const bStyle = badgeColors[tabName];

    let toggleBtnHtml = '';
    if ((me.role === 'super_admin' || me.role === 'doctor') && activeSub) {
        if (isComplaintsOpen) toggleBtnHtml = `<button type="button" class="btn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; color: #EF4444; padding: 8px 15px; border-radius: 8px;" onclick="toggleSubjectComplaints('${activeSub}', false)"><i class="fas fa-lock"></i> قفل تفاعل الطلاب (إيقاف الشكاوى)</button>`;
        else toggleBtnHtml = `<button type="button" class="btn" style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10B981; color: #10B981; padding: 8px 15px; border-radius: 8px;" onclick="toggleSubjectComplaints('${activeSub}', true)"><i class="fas fa-lock-open"></i> فتح تفاعل الطلاب (استقبال الشكاوى)</button>`;
    }

    document.getElementById(`${tabName}-title`).innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%; border-bottom: 1px dashed var(--border); padding-bottom: 10px; margin-bottom: 10px;">
            <div style="font-size:16px; color:${colors[tabName]}; font-weight:bold;"><i class="fas ${icons[tabName]}"></i> ${titles[tabName]} - مادة: <span style="color:#fff;">${sName}</span> <span style="${bStyle} display:inline-block; margin-top:5px; padding:4px 10px; border-radius:12px; font-size:12px; margin-right:5px; font-weight:bold;">العدد المعروض: ${list.length} طالب</span></div>
            ${me.role === 'super_admin' && activeSub && totalInSubject > 0 ? `<button type="button" class="btn btn-red" onclick="wipeSubjectComplaints('${activeSub}', '${tabName}')"><i class="fas fa-trash-alt"></i> مسح جميع الشكاوى (${titles[tabName]})</button>` : ''}
        </div>
        ${toggleBtnHtml ? `<div style="display:flex; justify-content:flex-start; margin-bottom: 15px;">${toggleBtnHtml}</div>` : ''}
    `;

    let relevantCommittees = globalCommittees.filter(c => c.subject_id === activeSub);
    const uniqueComNames = [...new Set(relevantCommittees.map(c => c.committee_name))];
    let btnHtml = `<button type="button" class="com-btn ${activeCom === 'all' ? 'active' : ''}" onclick="filterCommittee('all', '${tabName}')">كل اللجان</button>`;
    uniqueComNames.forEach(name => { btnHtml += `<button type="button" class="com-btn ${activeCom === name ? 'active' : ''}" onclick="filterCommittee('${name}', '${tabName}')">${name}</button>`; });
    document.getElementById(`filters-${tabName}`).innerHTML = btnHtml;

    const tbody = document.getElementById(`${tabName}-list`);
    if (list.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted); padding:30px;">لا توجد بيانات معروضة في هذا التصنيف.</td></tr>`; return; }

    tbody.innerHTML = list.map(c => {
        const isChanged = c.assigned_committee !== c.actual_committee && c.actual_committee && c.actual_committee.trim() !== '';
        const locs = isChanged ? `<div style="background:rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px; border-radius: 8px; font-size: 13px; line-height: 1.6; text-align: right; min-width: 120px; display:inline-block;"><span style="color:var(--text-muted)">المُسجل:</span> <strike style="color:#9CA3AF; font-size:14px; font-weight:bold;">${c.assigned_committee}</strike><br><span style="color:#EF4444">الفعلي:</span> <b style="color:#fff; font-size:16px;">${c.actual_committee}</b></div>` : `<div style="background:rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 8px; border-radius: 8px; font-size: 14px; color:#10B981; font-weight:bold; min-width: 100px; display:inline-block;">${c.assigned_committee}</div>`;
        const studentInfo = `<td><b style="font-size:14px;">${c.student_name}</b><br><span style="color:var(--gold); font-family:monospace; font-size:13px;">${c.student_id}</span></td>`;
        if(tabName === 'pending') return `<tr>${studentInfo}<td>${locs}</td><td class="text-wrap-bold">${c.problem}</td><td><div style="display:flex; justify-content:center; gap:5px; flex-direction:column;"><button type="button" class="btn btn-blue" onclick="replyComplaint('${c.tracking_id}', '${c.student_name}')"><i class="fas fa-reply"></i> رد وحل</button><button type="button" class="btn btn-gray" onclick="updateComplaintStatus('${c.tracking_id}', 'mark_spam')"><i class="fas fa-ban"></i> أسئ</button></div></td></tr>`;
        else if (tabName === 'resolved') return `<tr>${studentInfo}<td>${locs}</td><td class="text-wrap-bold" style="color:#9CA3AF; font-size:12px;">${c.problem}</td><td class="reply-wrap-bold">${c.admin_reply}</td><td style="font-size:12px; color:var(--gold); font-weight:bold;">${c.replied_by}</td><td><button type="button" class="btn btn-gold" onclick="editReply('${c.tracking_id}', '${c.student_name}')"><i class="fas fa-edit"></i> تعديل</button></td></tr>`;
        else if (tabName === 'spam') return `<tr>${studentInfo}<td>${locs}</td><td class="text-wrap-bold" style="color:#9CA3AF;">${c.problem}</td><td><div style="display:flex; justify-content:center; gap:5px; flex-direction:column;"><button type="button" class="btn btn-blue" onclick="updateComplaintStatus('${c.tracking_id}', 'restore_complaint')"><i class="fas fa-undo"></i> استرجاع</button><button type="button" class="btn btn-red" onclick="executeDelete('${c.tracking_id}', 'delete_complaint')"><i class="fas fa-trash"></i> حذف نهائي</button></div></td></tr>`;
    }).join('');
}

async function toggleSubjectComplaints(subId, isOpen) {
    const actionText = isOpen ? 'فتح استقبال الشكاوى' : 'قفل وإيقاف استقبال الشكاوى';
    const { isConfirmed } = await Swal.fire({...swalDark, title: 'تأكيد الإجراء', text: `هل أنت متأكد من ${actionText} لهذه المادة؟`, icon: 'warning', showCancelButton: true, confirmButtonColor: isOpen ? '#10B981' : '#EF4444', confirmButtonText: 'نعم، تأكيد', cancelButtonText: 'إلغاء'});
    if(isConfirmed) {
        Swal.fire({title: 'جاري التحديث...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            const data = await postAdminAction({action: 'toggle_subject_complaints', subject_id: subId, is_open: isOpen});
            if(data.status === 'success') { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم التحديث بنجاح!', timer: 1500, showConfirmButton: false}); } 
            else { Swal.fire({...swalDark, icon: 'error', text: data.message}); }
        } catch(e) {}
    }
}

async function wipeSubjectComplaints(subId, status) {
    if(!subId) return;
    const statusText = status === 'pending' ? 'الجديدة' : (status === 'resolved' ? 'المجاب عليها' : 'المرفوضة');
    const { isConfirmed } = await Swal.fire({...swalDark, title: 'تأكيد المسح؟', text: `سيتم مسح جميع الشكاوى (${statusText}) التابعة لهذه المادة نهائياً!`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'نعم، امسح الكل', cancelButtonText: 'إلغاء' });
    if(isConfirmed) {
        Swal.fire({title: 'جاري المسح...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try {
            await postAdminAction({action: 'wipe_subject_complaints', subject_id: subId, status: status});
            await refreshData();
            Swal.fire({...swalDark, icon: 'success', title: 'تم المسح بنجاح!', timer: 1500, showConfirmButton: false});
        } catch(e) {}
    }
}

function switchTab(id, el) {
    const allDropdownTabs = ['committees', 'pending', 'resolved', 'spam', 'students'];
    allDropdownTabs.forEach(t => { const menu = document.getElementById(`menu-${t}`); if (menu) menu.classList.remove('open'); const tab = document.getElementById(`tab-${t}`); if (tab) tab.classList.remove('open-menu', 'active'); });
    document.querySelectorAll('.content-section').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-links > li').forEach(l => l.classList.remove('active'));
    document.getElementById(id).classList.add('active'); if(el) el.classList.add('active'); if(window.innerWidth <= 1024) toggleSidebar();
}

async function deleteAction(action, id, isStaff = false) {
    if (isStaff && action === 'manage_staff' && me.role === 'doctor') {
        const target = globalStaff.find(s => s.username === id);
        let mySubs = me.allowed_subjects || [], targetSubs = target.allowed_subjects || [];
        let remaining = targetSubs.filter(s => !mySubs.includes(s));
        const isOwner = (target.created_by === me.username);

        if (!isOwner) {
            const { isConfirmed } = await Swal.fire({...swalDark, title: 'إزالة الصلاحيات', text: 'أنت لست من قام بإنشاء هذا المعيد. هل تريد إزالته من موادك فقط؟', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'نعم، إزالة من موادي', cancelButtonText: 'إلغاء' });
            if (isConfirmed) await updateStaffSubjects(id, []);
            return;
        }

        if (remaining.length === 0) {
            const { isConfirmed, isDenied } = await Swal.fire({...swalDark, title: 'إدارة المعيد', text: 'هذا المعيد لا يمتلك أي صلاحيات مع دكاترة آخرين (وأنت من قمت بإنشائه). هل تريد حذفه نهائياً من النظام أم إزالته من موادك فقط؟', icon: 'warning', showCancelButton: true, showDenyButton: true, confirmButtonText: 'حذف نهائي', denyButtonText: 'إزالة من موادي فقط', cancelButtonText: 'إلغاء', confirmButtonColor: '#EF4444', denyButtonColor: '#FFB300' });
            if (isConfirmed) await executeDelete('manage_staff', id, true); else if (isDenied) await updateStaffSubjects(id, []);
        } else {
            const { isConfirmed } = await Swal.fire({...swalDark, title: 'إزالة الصلاحيات', text: 'لا يمكنك حذف المعيد نهائياً لأنه مرتبط بمواد دكاترة آخرين حالياً. هل تريد إزالته من موادك فقط؟', icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'نعم، إزالة', cancelButtonText: 'إلغاء' });
            if (isConfirmed) await updateStaffSubjects(id, []);
        }
    } else { if(confirm('تأكيد الحذف النهائي؟')) await executeDelete(action, id, isStaff); }
}

async function executeDelete(action, id, isStaff=false) {
    Swal.fire({title: 'جاري الحذف...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
    let reqBody = {};
    if (action === 'manage_student') reqBody = {action: action, sub: 'delete', student_id: id};
    else if (action === 'delete_complaint') reqBody = {action: action, tracking_id: id};
    else reqBody = isStaff ? {action, sub: 'delete', username: id} : {action, sub: 'delete', id};
    try {
        const data = await postAdminAction(reqBody);
        if(data.status === 'error') Swal.fire({...swalDark, icon: 'error', text: data.message});
        else { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم الحذف بنجاح!', timer: 1500, showConfirmButton: false}); }
    } catch(e) {}
}

async function updateStaffSubjects(targetUsername, newSubjectsList) {
    const target = globalStaff.find(s => s.username === targetUsername);
    const form = { name: target.name, username: target.username, password: "", role: target.role, allowed_subjects: newSubjectsList };
    Swal.fire({title: 'جاري التحديث...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
    try {
        const data = await postAdminAction({action:'manage_staff', sub:'edit', old_username: targetUsername, staff:form});
        if(data.status === 'success') { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم التحديث بنجاح!', timer: 1500, showConfirmButton: false}); }
        else Swal.fire({...swalDark, icon: 'error', text: data.message});
    } catch(e) {}
}

async function replyComplaint(tracking_id, student_name, existing_reply = '') {
    const { value: replyText } = await Swal.fire({ title: `رد على شكوى (${student_name})`, inputValue: existing_reply, input: 'textarea', inputPlaceholder: 'اكتب رسالتك للطالب هنا...', confirmButtonText: 'إرسال الرد <i class="fas fa-paper-plane"></i>', showCancelButton: true, cancelButtonText: 'إلغاء', confirmButtonColor: '#10B981', background: '#1a1f2c', color: '#fff', inputValidator: (val) => { if (!val.trim()) return 'يجب كتابة رد!'; } });
    if(replyText) {
        Swal.fire({title: 'جاري الإرسال...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try { await postAdminAction({action: 'reply_complaint', tracking_id: tracking_id, reply: replyText}); await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم الإرسال بنجاح!', timer: 1500, showConfirmButton: false}); } catch(e) {}
    }
}

function editReply(tracking_id, student_name) { const complaint = fullComplaints.find(c => c.tracking_id === tracking_id); if(complaint) replyComplaint(tracking_id, student_name, complaint.admin_reply); }
async function updateComplaintStatus(tracking_id, action) { let confirmMsg = action === 'mark_spam' ? 'نقل الشكوى للمرفوضين (الأسئ)؟' : (action === 'delete_complaint' ? 'حذف الشكوى نهائياً؟' : 'استرجاع الشكوى لرد عليها؟'); if(confirm(confirmMsg)) { try { await postAdminAction({action: action, tracking_id: tracking_id}); await refreshData(); } catch(e) {} } }
async function wipeDatabase() {
    const { value: password } = await Swal.fire({...swalDark, icon: 'warning', title: 'تدمير قاعدة البيانات!', html: '<p style="color:#EF4444; font-size:14px;">سيتم مسح (المواد، اللجان، الشكاوى، الطلاب) بالكامل ولن يمكن استرجاعها.</p>', input: 'password', inputPlaceholder: 'أدخل الباسورد الخاص بك للتأكيد', showCancelButton: true, confirmButtonColor: '#EF4444', confirmButtonText: 'تأكيد التدمير', cancelButtonText: 'إلغاء' });
    if (password) {
        Swal.fire({ title: 'جاري مسح البيانات...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading() });
        try { const data = await postAdminAction({action: 'wipe_all', admin_password: password}); if(data.status === 'success') { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم التنظيف بنجاح!'}); } else { Swal.fire({...swalDark, icon: 'error', title: 'فشل!', text: data.message}); } } catch(e) {}
    }
}

async function addSubject() { 
    let defaultYear = "", defaultDept = "عام (IT)";
    if (activeSubjectsFilter !== 'all') { if (activeSubjectsFilter.includes('_')) { const parts = activeSubjectsFilter.split('_'); defaultYear = parts[0]; defaultDept = parts[1]; } else { defaultYear = activeSubjectsFilter; } }
    let yearOpts = `<option value="" disabled ${!defaultYear ? "selected" : ""}>اختر الفرقة الدراسية</option>`;
    ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة"].forEach(y => { yearOpts += `<option value="${y}" ${defaultYear === y ? "selected" : ""}>${y}</option>`; });
    let deptOpts = "";
    if (defaultYear === 'الفرقة الثالثة' || defaultYear === 'الفرقة الرابعة') { deptOpts += `<option value="عام (IT)" ${defaultDept === 'عام (IT)' ? 'selected' : ''}>عام (IT)</option><option value="Software" ${defaultDept === 'Software' ? 'selected' : ''}>Software</option><option value="Network" ${defaultDept === 'Network' ? 'selected' : ''}>Network</option>`; } else deptOpts = `<option value="عام (IT)" selected>عام (IT)</option>`;

    const formHtml = `<input id="sn" class="login-input" placeholder="اسم المادة"><select id="s-year" class="login-input" style="background:#000;">${yearOpts}</select><select id="s-dept" class="login-input" style="background:#000;">${deptOpts}</select><p style="text-align:right; font-size:12px; color:var(--text-muted);">أيقونة / صورة المادة:</p><input type="file" id="si" class="login-input" accept="image/*">`;
    const { value: v } = await Swal.fire({ 
        ...swalDark, title: 'إضافة مادة جديدة', html: formHtml,
        didOpen: () => { document.getElementById('s-year').addEventListener('change', (e) => { const deptSelect = document.getElementById('s-dept'); if (e.target.value === 'الفرقة الثالثة' || e.target.value === 'الفرقة الرابعة') deptSelect.innerHTML = '<option value="عام (IT)">عام (IT)</option><option value="Software">Software</option><option value="Network">Network</option>'; else deptSelect.innerHTML = '<option value="عام (IT)">عام (IT)</option>'; }); },
        preConfirm: () => { const n = document.getElementById('sn').value, y = document.getElementById('s-year').value, d = document.getElementById('s-dept').value, f = document.getElementById('si').files[0]; if(!n || !y || !d || !f) return Swal.showValidationMessage('يرجى استكمال جميع البيانات!'); return new Promise(r => { const rd = new FileReader(); rd.onload = (e) => r({ id: "SUB_"+Date.now(), name: n, year: y, department: d, image: e.target.result }); rd.readAsDataURL(f); }); } 
    });

    if(v) { 
        Swal.fire({title: 'جاري الحفظ...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try { const data = await postAdminAction({action:'manage_subject', sub:'add', subject:v}); if(data.status === 'error') Swal.fire({...swalDark, icon: 'error', text: data.message}); else { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم إضافة المادة!', timer: 1500, showConfirmButton: false}); } } catch(e) {}
    }
}

async function editSubject(subId) {
    const subject = globalSubjects.find(s => s.id === subId); if (!subject) return;
    let yearOpts = ""; ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة"].forEach(y => { yearOpts += `<option value="${y}" ${subject.year === y ? "selected" : ""}>${y}</option>`; });
    let deptOpts = ""; if (subject.year === 'الفرقة الثالثة' || subject.year === 'الفرقة الرابعة') { deptOpts += `<option value="عام (IT)" ${subject.department === 'عام (IT)' ? 'selected' : ''}>عام (IT)</option><option value="Software" ${subject.department === 'Software' ? 'selected' : ''}>Software</option><option value="Network" ${subject.department === 'Network' ? 'selected' : ''}>Network</option>`; } else deptOpts = `<option value="عام (IT)" selected>عام (IT)</option>`;
    const formHtml = `<input id="esn" class="login-input" placeholder="اسم المادة" value="${subject.name}"><select id="es-year" class="login-input" style="background:#000;">${yearOpts}</select><select id="es-dept" class="login-input" style="background:#000;">${deptOpts}</select><p style="text-align:right; font-size:12px; color:var(--text-muted);">تغيير الصورة (اتركه فارغاً لعدم التغيير):</p><input type="file" id="esi" class="login-input" accept="image/*">`;

    const { value: v } = await Swal.fire({
        ...swalDark, title: 'تعديل بيانات المادة', html: formHtml,
        didOpen: () => { document.getElementById('es-year').addEventListener('change', (e) => { const deptSelect = document.getElementById('es-dept'); if (e.target.value === 'الفرقة الثالثة' || e.target.value === 'الفرقة الرابعة') deptSelect.innerHTML = '<option value="عام (IT)">عام (IT)</option><option value="Software">Software</option><option value="Network">Network</option>'; else deptSelect.innerHTML = '<option value="عام (IT)">عام (IT)</option>'; }); },
        preConfirm: () => { const n = document.getElementById('esn').value, y = document.getElementById('es-year').value, d = document.getElementById('es-dept').value, f = document.getElementById('esi').files[0]; if(!n || !y) return Swal.showValidationMessage('يرجى استكمال البيانات الأساسية!'); if (f) return new Promise(r => { const rd = new FileReader(); rd.onload = (e) => r({ id: subject.id, name: n, year: y, department: d, image: e.target.result }); rd.readAsDataURL(f); }); else return { id: subject.id, name: n, year: y, department: d }; }
    });

    if(v) {
        Swal.fire({title: 'جاري الحفظ...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try { const data = await postAdminAction({action:'manage_subject', sub:'edit', subject:v}); if(data.status === 'error') Swal.fire({...swalDark, icon: 'error', text: data.message}); else { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم التعديل!', timer: 1500, showConfirmButton: false}); } } catch(e) {}
    }
}

async function addCommittee() {
    let activeSubId = committeeFilter.sub; let opts = globalSubjects.map(s => { let isSelected = (s.id === activeSubId) ? 'selected' : ''; return `<option value="${s.id}" ${isSelected}>${s.name} (${s.year} - ${s.department})</option>`; }).join('');
    if(!opts) return Swal.fire({...swalDark, icon:'warning', text:'قم بإضافة مادة واحدة على الأقل أولاً!'});
    const { value: v } = await Swal.fire({ ...swalDark, title: 'توزيع قائمة لجان', html: `<select id="asub" class="login-input" style="background:#000;"><option value="" disabled>اختر المادة</option>${opts}</select><input id="acom" class="login-input" placeholder="اسم المدرج/اللجنة"><p style="text-align:right; font-size:12px; color:var(--text-muted);">الصق جميع الـ IDs تحت بعضها هنا:</p><textarea id="araw" class="login-input ltr-input" style="height:150px;"></textarea>`, preConfirm: () => { const sub = document.getElementById('asub').value, com = document.getElementById('acom').value, raw = document.getElementById('araw').value; if(!sub || !com || !raw) return Swal.showValidationMessage('بيانات ناقصة'); return { subject_id: sub, name: com, raw_ids: raw }; } });
    if(v) { Swal.fire({title: 'جاري استخراج وتسجيل الأرقام...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()}); try { await postAdminAction({action:'manage_committee', sub:'add', committee:v}); await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم توزيع اللجنة بنجاح!', timer: 1500, showConfirmButton: false}); } catch(e) {} }
}

async function copyCommitteesFromOtherSubject() {
    let activeSubId = committeeFilter.sub; let currentSub = globalSubjects.find(s => s.id === activeSubId);
    if(!currentSub) return Swal.fire({...swalDark, icon:'warning', text:'قم باختيار المادة التي تريد الاستيراد إليها أولاً!'});
    let matchingSubs = globalSubjects.filter(s => { if (s.id === currentSub.id) return false; if (s.year !== currentSub.year) return false; if (currentSub.department === 'عام (IT)') return true; return s.department === currentSub.department || s.department === 'عام (IT)'; });
    if(matchingSubs.length === 0) return Swal.fire({...swalDark, icon:'info', text:'لا توجد مواد مطابقة (نفس القسم أو مواد عامة) في هذه الفرقة لنقل اللجان منها.'});
    let generalOpts = matchingSubs.filter(s => s.department === 'عام (IT)').map(s => `<option value="${s.id}">${s.name} (عام / مشترك)</option>`).join(''), specificOpts = matchingSubs.filter(s => s.department !== 'عام (IT)').map(s => `<option value="${s.id}">${s.name} (${s.department})</option>`).join(''), finalOpts = '';
    if (specificOpts) finalOpts += `<optgroup label="مواد التخصص (${currentSub.department !== 'عام (IT)' ? currentSub.department : 'أخرى'})">${specificOpts}</optgroup>`; if (generalOpts) finalOpts += `<optgroup label="مواد عامة (مشتركة)">${generalOpts}</optgroup>`;
    const { value: sourceSubId } = await Swal.fire({ ...swalDark, title: 'استيراد اللجان', html: `<div style="text-align:right; font-size:13px; color:var(--text-muted); margin-bottom:15px; background:rgba(255,179,0,0.1); padding:10px; border-radius:8px; border:1px solid rgba(255,179,0,0.3);">سيتم استيراد اللجان إلى المادة المحددة: <br><b style="color:var(--gold); font-size:15px;">${currentSub.name}</b> <span style="font-size:11px;">(${currentSub.department})</span></div><select id="source-sub" class="login-input" style="background:#000;"><option value="" disabled selected>اختر المادة لسحب لجانها...</option>${finalOpts}</select>`, preConfirm: () => { const val = document.getElementById('source-sub').value; if(!val) return Swal.showValidationMessage('الرجاء اختيار مادة للاستيراد منها!'); return val; } });
    if(sourceSubId) {
        let sourceCommittees = globalCommittees.filter(c => c.subject_id === sourceSubId);
        if(sourceCommittees.length === 0) return Swal.fire({...swalDark, icon:'warning', text:'المادة المختارة لا تحتوي على أي لجان حالياً لاستيرادها!'});
        Swal.fire({title: 'جاري النسخ والاستيراد...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()});
        try { for(let com of sourceCommittees) { let newComData = { subject_id: currentSub.id, name: com.committee_name, raw_ids: com.ids.join('\n') }; await postAdminAction({action: 'manage_committee', sub: 'add', committee: newComData}); } await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم استيراد اللجان بنجاح!', timer: 1500, showConfirmButton: false}); } catch(e) {}
    }
}

function getGroupedSubjectsHTML(allowedSubjects = []) {
    let html = '<div style="background:#0d1117; padding:15px; border-radius:10px; border:1px solid #374151; max-height:250px; overflow-y:auto; text-align:right;">'; const years = ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة"];
    years.forEach(year => {
        const yearSubs = globalSubjects.filter(s => s.year === year);
        if (yearSubs.length > 0) {
            html += `<div style="margin-bottom: 15px;"><h4 style="color:var(--gold); margin-bottom:10px; font-size:14px; border-bottom:1px dashed #374151; padding-bottom:5px;">${year}</h4><div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:8px;">`;
            yearSubs.forEach(s => {
                const isChecked = allowedSubjects.includes(s.id) ? 'checked' : ''; const deptLabel = s.department === 'عام (IT)' ? '' : `<span style="color:#9CA3AF; font-size:11px;">(${s.department})</span>`;
                html += `<label style="background:#1F2937; padding:8px 10px; border-radius:8px; font-size:12px; cursor:pointer; color:#fff; display:flex; align-items:center; gap:8px; border:1px solid #4B5563; transition:0.3s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.name}"><input type="checkbox" class="st-sub-check" value="${s.id}" ${isChecked} style="accent-color:var(--gold); transform:scale(1.2); flex-shrink:0;"> <span style="overflow:hidden; text-overflow:ellipsis;">${s.name} ${deptLabel}</span></label>`;
            }); html += `</div></div>`;
        }
    }); html += '</div>'; return html === '<div style="background:#0d1117; padding:15px; border-radius:10px; border:1px solid #374151; max-height:250px; overflow-y:auto; text-align:right;"></div>' ? '<p style="color:#EF4444; font-size:12px;">لا توجد مواد مضافة بعد.</p>' : html;
}

async function addStaff() {
    let roleSelectHtml = ''; if(me.role === 'super_admin') roleSelectHtml = `<select id="st-role" class="login-input" style="background:#000;"><option value="doctor">تحديد كـ دكتور مادة</option><option value="ta" selected>تحديد كـ معيد</option></select>`; else roleSelectHtml = `<p style="text-align:right; color:#10B981; font-size:12px; margin-bottom:15px;"><i class="fas fa-info-circle"></i> سيتم إضافة هذا المستخدم كـ (معيد) تحت إشرافك.</p>`;
    const { value: form } = await Swal.fire({ ...swalDark, width: '600px', title: 'إضافة عضو للطاقم', html: `<input id="st-name" class="login-input" placeholder="الاسم (مثال: أ. أحمد)"><input id="st-user" class="login-input ltr-input" placeholder="Username"><input id="st-pass" class="login-input ltr-input" type="password" placeholder="Password">${roleSelectHtml}<p style="text-align:right; color:#9CA3AF; font-size:12px; margin-bottom:5px;">صلاحيات المواد المسموحة:</p>${getGroupedSubjectsHTML([])}`, preConfirm: () => { const name = document.getElementById('st-name').value, user = document.getElementById('st-user').value, pass = document.getElementById('st-pass').value; let role = 'ta'; if(me.role === 'super_admin') role = document.getElementById('st-role').value; const checkedBoxes = document.querySelectorAll('.st-sub-check:checked'); const allowedSubjects = Array.from(checkedBoxes).map(cb => cb.value); if(!name || !user || !pass) return Swal.showValidationMessage('بيانات أساسية ناقصة'); return { name: name, username: user, password: pass, role: role, allowed_subjects: allowedSubjects }; } });
    if(form) { Swal.fire({title: 'جاري الإضافة...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()}); try { const data = await postAdminAction({action:'manage_staff', sub:'add', staff:form}); if(data.status === 'error') { Swal.fire({...swalDark, icon: 'error', text: data.message}); } else { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تمت الإضافة بنجاح!', timer: 1500, showConfirmButton: false}); } } catch(e) {} }
}

window.filterTAList = function() { const q = document.getElementById('search-ta').value.toLowerCase(); const items = document.querySelectorAll('.ta-item'); items.forEach(item => { const text = item.innerText.toLowerCase(); item.style.display = text.includes(q) ? 'block' : 'none'; }); };
window.selectTAItem = function(el) { document.querySelectorAll('.ta-item').forEach(i => { i.style.background = '#1F2937'; i.style.border = 'none'; }); el.style.background = 'rgba(16, 185, 129, 0.1)'; el.style.border = '1px solid #10B981'; tempSelectedTA = el.getAttribute('data-id'); };

async function assignExistingTA() {
    tempAvailableTAs = globalStaff.filter(s => !s.allowed_subjects || s.allowed_subjects.length === 0);
    if(tempAvailableTAs.length === 0) return Swal.fire({...swalDark, icon: 'info', text: 'لا يوجد معيدين متاحين للتعيين، إما أنهم مضافون بالفعل في موادك أو لا يوجد معيدين مسجلين.'});
    tempSelectedTA = null;
    const { value: selectedUsername } = await Swal.fire({ ...swalDark, title: 'تعيين معيد مسجل مسبقاً', html: `<p style="text-align:right; font-size:13px; color:var(--text-muted); margin-bottom:10px;">ابحث واختر المعيد الذي تريد إضافته لموادك:</p><input id="search-ta" class="login-input" placeholder="ابحث بالاسم هنا..." style="margin-bottom:10px; padding:10px; font-size:13px;" onkeyup="filterTAList()"><div id="ta-list-container" style="max-height: 200px; overflow-y: auto; background: #0d1117; border-radius: 12px; border: 1px solid #374151; padding: 10px; text-align: right; display: flex; flex-direction: column; gap: 5px;">${tempAvailableTAs.map(ta => `<div class="ta-item" data-id="${ta.username}" onclick="selectTAItem(this)" style="padding: 10px; border-radius: 8px; cursor: pointer; color: #fff; background: #1F2937; transition: 0.3s; font-size:14px; font-weight:bold;"><i class="fas fa-user" style="color:var(--gold); margin-left:8px;"></i> ${ta.name}</div>`).join('')}</div>`, preConfirm: () => { if(!tempSelectedTA) return Swal.showValidationMessage('الرجاء اختيار معيد من القائمة أولاً!'); return tempSelectedTA; } });
    if (selectedUsername) assignSubjectsToTA(selectedUsername);
}

async function assignSubjectsToTA(targetUsername) {
    const staffMember = globalStaff.find(s => s.username === targetUsername); if(!staffMember) return;
    const { value: form } = await Swal.fire({ ...swalDark, width: '600px', title: 'تعيين صلاحيات المواد', html: `<div style="background:rgba(255,179,0,0.1); border:1px solid rgba(255,179,0,0.3); padding:12px; border-radius:8px; margin-bottom:15px; text-align:right;"><p style="color:var(--gold); font-weight:bold; font-size:15px;"><i class="fas fa-user-graduate"></i> المعيد: ${staffMember.name}</p></div><p style="text-align:right; color:#9CA3AF; font-size:13px; margin-bottom:10px;">حدد المواد التي ترغب بتعيينه فيها:</p>${getGroupedSubjectsHTML(staffMember.allowed_subjects || [])}`, preConfirm: () => { const checkedBoxes = document.querySelectorAll('.st-sub-check:checked'); const allowedSubjects = Array.from(checkedBoxes).map(cb => cb.value); return { name: staffMember.name, username: staffMember.username, password: "", role: staffMember.role, allowed_subjects: allowedSubjects }; } });
    if(form) { Swal.fire({title: 'جاري الحفظ والتحديث...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()}); try { const data = await postAdminAction({action:'manage_staff', sub:'edit', old_username: targetUsername, staff:form}); if(data.status === 'error') Swal.fire({...swalDark, icon: 'error', text: data.message}); else { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم التعيين بنجاح!', timer: 1500, showConfirmButton: false}); } } catch(e) {} }
}

async function editStaff(targetUsername) {
    const staffMember = globalStaff.find(s => s.username === targetUsername); if(!staffMember) return;
    let roleSelectHtml = ''; if(me.role === 'super_admin') { const docSel = staffMember.role === 'doctor' ? 'selected' : ''; const taSel = staffMember.role === 'ta' ? 'selected' : ''; roleSelectHtml = `<select id="st-role-edit" class="login-input" style="background:#000;"><option value="doctor" ${docSel}>دكتور مادة</option><option value="ta" ${taSel}>معيد</option></select>`; } else roleSelectHtml = `<p style="text-align:right; color:#10B981; font-size:12px; margin-bottom:15px;"><i class="fas fa-info-circle"></i> هذا المستخدم مسجل كـ (معيد).</p>`;
    const { value: form } = await Swal.fire({ ...swalDark, width: '600px', title: 'تعديل بيانات العضو', html: `<input id="st-name-edit" class="login-input" placeholder="الاسم" value="${staffMember.name}"><input id="st-user-edit" class="login-input ltr-input" placeholder="Username" value="${staffMember.username}"><input id="st-pass-edit" class="login-input ltr-input" type="password" placeholder="New Password (Leave empty to keep)">${roleSelectHtml}<p style="text-align:right; color:#9CA3AF; font-size:12px; margin-bottom:5px;">صلاحيات المواد المسموحة:</p>${getGroupedSubjectsHTML(staffMember.allowed_subjects || [])}`, preConfirm: () => { const name = document.getElementById('st-name-edit').value, user = document.getElementById('st-user-edit').value, pass = document.getElementById('st-pass-edit').value; let role = staffMember.role; if(me.role === 'super_admin') role = document.getElementById('st-role-edit').value; const checkedBoxes = document.querySelectorAll('.st-sub-check:checked'); const allowedSubjects = Array.from(checkedBoxes).map(cb => cb.value); if(!name || !user) return Swal.showValidationMessage('الاسم واسم الدخول مطلوبان'); return { name: name, username: user, password: pass, role: role, allowed_subjects: allowedSubjects }; } });
    if(form) { Swal.fire({title: 'جاري الحفظ والتحديث...', background: '#1a1f2c', color: '#fff', didOpen: () => Swal.showLoading()}); try { const data = await postAdminAction({action:'manage_staff', sub:'edit', old_username: targetUsername, staff:form}); if(data.status === 'error') { Swal.fire({...swalDark, icon: 'error', text: data.message}); } else { await refreshData(); Swal.fire({...swalDark, icon: 'success', title: 'تم التعديل بنجاح!', timer: 1500, showConfirmButton: false}); } } catch(e) {} }
}