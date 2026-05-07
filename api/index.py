import os
from flask import Flask, render_template, request, jsonify, session, redirect, make_response
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import re
import random
import string
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, template_folder='../templates', static_folder='../static', static_url_path='/static')

# هنا التعديل: تثبيت مفتاح التشفير لعدم فقدان الجلسة عند إعادة تشغيل السيرفر
app.secret_key = os.environ.get("SECRET_KEY", "Nexus_Super_Secret_Key_2026_Fixed")

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["500 per day", "100 per hour"],
    storage_uri="memory://"
)

MONGO_URI = os.environ.get("MONGO_URI", "mongodb+srv://admin:admin1312312313@aws.rhgcybe.mongodb.net/?appName=aws")
client = MongoClient(MONGO_URI)
db = client['university_system']

users_col = db['users']
subjects_col = db['subjects']
committees_col = db['committees']
complaints_col = db['complaints']
settings_col = db['settings']
students_col = db['students']

try:
    users_col.create_index("username", unique=True)
    complaints_col.create_index("tracking_id", unique=True)
    committees_col.create_index([("subject_id", 1), ("ids", 1)])
    students_col.create_index("student_id", unique=True)
except:
    pass

SYSTEM_IS_OPEN_CACHE = None

if not users_col.find_one({"role": "super_admin"}):
    users_col.insert_one({
        "role": "super_admin",
        "username": "Nexus", 
        "password": generate_password_hash("Nexus2026@batu"), 
        "name": "الآدمن الرئيسي"
    })

if not settings_col.find_one({"type": "system_status"}):
    settings_col.insert_one({"type": "system_status", "is_open": True})

@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

@app.errorhandler(429)
def ratelimit_handler(e):
    if request.path.startswith('/api/') or request.path.startswith('/secure-auth'):
        return jsonify({"status": "error", "message": "تم تجاوز الحد المسموح من المحاولات. يرجى الانتظار 30 ثانية ثم المحاولة مجدداً."}), 429
    return """<!doctype html><html lang=ar dir=rtl><title>تنبيه</title><h1 style="text-align:center; margin-top:50px; color:red;">تم تجاوز الحد المسموح من المحاولات. يرجى الانتظار 30 ثانية.</h1></html>""", 429

def check_system_open():
    global SYSTEM_IS_OPEN_CACHE
    if SYSTEM_IS_OPEN_CACHE is None:
        status = settings_col.find_one({"type": "system_status"})
        SYSTEM_IS_OPEN_CACHE = status.get('is_open', True) if status else True
    return SYSTEM_IS_OPEN_CACHE

def generate_tracking_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def verify_student_credentials(student_id, pwd):
    student = students_col.find_one({"student_id": student_id})
    if not student: return None
    
    if check_password_hash(student['password'], pwd) or student['password'] == pwd:
        if student['password'] == pwd: 
            students_col.update_one({"student_id": student_id}, {"$set": {"password": generate_password_hash(pwd)}})
        return student
    return None

@app.route('/')
@limiter.limit("5 per 15 seconds")
def index():
    if not check_system_open():
        return """<!doctype html><html lang=ar dir=rtl><title>النظام مغلق</title><h1 style="text-align:center; margin-top:50px;">النظام مغلق حالياً</h1></html>""", 403
    return render_template('index.html')

@app.route('/api/student-login', methods=['POST'])
@limiter.limit("5 per 30 seconds") 
def student_login():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    
    data = request.json
    s_id = str(data.get('student_id', '')).strip()
    pwd = str(data.get('password', '')).strip()
    
    student = verify_student_credentials(s_id, pwd)
    
    if student:
        student.pop('password', None) 
        student.pop('_id', None)
        return jsonify({"status": "success", "student": student})
    else:
        return jsonify({"status": "error", "message": "رقم الـ ID أو كلمة المرور غير صحيحة!"}), 401

@app.route('/api/student-action', methods=['POST'])
@limiter.limit("5 per 15 seconds")
def student_action():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    
    data = request.json
    action = str(data.get('action', ''))
    s_id = str(data.get('student_id', '')).strip()
    pwd = str(data.get('password', '')).strip()

    if action == 'change_password':
        old_p = str(data.get('old_password', '')).strip()
        new_p = str(data.get('new_password', '')).strip()
        
        if not verify_student_credentials(s_id, old_p):
            return jsonify({"status": "error", "message": "كلمة المرور الحالية غير صحيحة!"}), 400
            
        hashed_new = generate_password_hash(new_p)
        students_col.update_one({"student_id": s_id}, {"$set": {"password": hashed_new}})
        return jsonify({"status": "success"})
    
    if not verify_student_credentials(s_id, pwd):
        return jsonify({"status": "error", "message": "انتهت الجلسة أو تم تغيير بياناتك. يرجى تسجيل الدخول مجدداً."}), 401
        
    if action == 'get_complaints':
        my_complaints = list(complaints_col.find({"student_id": s_id}, {"_id": 0}))
        for c in my_complaints:
            sub = subjects_col.find_one({"id": c.get('subject_id')})
            c['is_open'] = sub.get('complaints_open', True) if sub else True
            
        my_complaints.reverse()
        return jsonify({"status": "success", "complaints": my_complaints})
        
    elif action == 'edit_complaint':
        tracking_id = str(data.get('tracking_id', ''))
        new_prob = str(data.get('new_problem', ''))
        comp = complaints_col.find_one({"tracking_id": tracking_id, "student_id": s_id})
        
        if comp and comp.get('status') == 'pending':
            sub = subjects_col.find_one({"id": comp.get('subject_id')})
            if sub and not sub.get('complaints_open', True):
                return jsonify({"status": "error", "message": "عفواً، تم إغلاق باب الشكاوى والتعديل لهذه المادة."}), 403
                
            complaints_col.update_one({"tracking_id": tracking_id}, {"$set": {"problem": new_prob[:150]}})
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "لا يمكن تعديل هذه الشكوى الآن."}), 400
        
    elif action == 'delete_complaint':
        tracking_id = str(data.get('tracking_id', ''))
        comp = complaints_col.find_one({"tracking_id": tracking_id, "student_id": s_id})
        
        if comp and comp.get('status') == 'pending':
            sub = subjects_col.find_one({"id": comp.get('subject_id')})
            if sub and not sub.get('complaints_open', True):
                return jsonify({"status": "error", "message": "عفواً، تم إغلاق باب الشكاوى ولا يمكن الحذف الآن."}), 403
                
            complaints_col.delete_one({"tracking_id": tracking_id})
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "لا يمكن حذف هذه الشكوى."}), 400
        
    return jsonify({"status": "error", "message": "إجراء غير معروف"}), 400

@app.route('/api/get-subjects')
@limiter.limit("5 per 15 seconds; 30 per minute; 150 per hour")
def get_subjects():
    if not check_system_open(): return jsonify({"status": "error", "message": "System Closed"}), 403
    subjects = list(subjects_col.find({}, {"_id": 0}))
    return jsonify({"subjects": subjects})

@app.route('/api/check-id', methods=['POST'])
@limiter.limit("5 per 15 seconds")
def check_id():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    
    data = request.json
    subject_id = str(data.get('subject_id', ''))
    student_id = str(data.get('student_id', '')).strip()
    pwd = str(data.get('password', '')).strip()
    
    if not verify_student_credentials(student_id, pwd):
        return jsonify({"status": "error", "message": "انتهت الجلسة أو تم تغيير بياناتك. يرجى تسجيل الدخول مجدداً."}), 401
    
    if len(student_id) != 7 or not student_id.isdigit():
        return jsonify({"status": "error", "message": "رقم الـ ID يجب أن يكون 7 أرقام فقط"}), 400
        
    committee = committees_col.find_one({"subject_id": subject_id, "ids": student_id})
    if committee:
        existing_comp = complaints_col.find_one({"subject_id": subject_id, "student_id": student_id}, {"_id": 0})
        
        return jsonify({
            "status": "success", 
            "committee_name": committee['committee_name'],
            "existing_complaint": existing_comp
        })
    else:
        return jsonify({"status": "error", "message": "لم يتم العثور على هذا الـ ID في هذه المادة. تأكد من الرقم."})

@app.route('/api/submit-complaint', methods=['POST'])
@limiter.limit("5 per 15 seconds")
def submit_complaint():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    
    data = request.json
    student_id = str(data.get('student_id', ''))
    pwd = str(data.get('password', '')).strip()
    
    if not verify_student_credentials(student_id, pwd):
        return jsonify({"status": "error", "message": "انتهت الجلسة أو تم تغيير بياناتك. يرجى تسجيل الدخول مجدداً."}), 401
    
    subject_id = str(data.get('subject_id', ''))
    subject = subjects_col.find_one({"id": subject_id})
    if subject and not subject.get('complaints_open', True):
        return jsonify({"status": "error", "message": "عفواً، تم إغلاق باب استقبال الشكاوى لهذه المادة من قبل دكتور المادة."}), 403

    existing_complaint = complaints_col.find_one({
        "student_id": student_id,
        "subject_id": subject_id
    })
    
    if existing_complaint:
        return jsonify({
            "status": "error", 
            "message": "لقد قمت بتقديم شكوى في هذه المادة مسبقاً! يرجى مراجعة (سجل شكاوي) لمتابعة الرد أو تعديل الشكوى."
        }), 400

    tracking_id = generate_tracking_id()
    
    complaints_col.insert_one({
        "tracking_id": tracking_id,
        "subject_id": subject_id,
        "subject_name": str(data.get('subject_name', '')),
        "student_id": student_id,
        "student_name": str(data.get('student_name', '')),
        "assigned_committee": str(data.get('assigned_committee', '')),
        "actual_committee": str(data.get('actual_committee', '')),
        "problem": str(data.get('problem', ''))[:150], 
        "status": "pending",
        "admin_reply": ""
    })
    return jsonify({"status": "success"})

@app.route('/secure-auth-gateway-2026-x9v2-pl7q-a84m', methods=['GET', 'POST'])
@limiter.limit("5 per 30 seconds") 
def admin_login():
    if request.method == 'POST':
        username = str(request.json.get('username', '')).strip()
        password = str(request.json.get('password', '')).strip()
        
        user = users_col.find_one({"username": username})
        
        if user and (check_password_hash(user['password'], password) or user['password'] == password):
            if user['password'] == password:
                users_col.update_one({"username": username}, {"$set": {"password": generate_password_hash(password)}})
                
            session['admin'] = {"username": user['username'], "role": user['role'], "name": user['name']}
            return jsonify({"status": "success"})
            
        return jsonify({"status": "error", "message": "بيانات الدخول غير صحيحة"}), 401
    return render_template('admin.html')

@app.route('/logout-gateway-vip-x9v2-pL7q-2026')
def logout():
    session.clear()
    return redirect('/secure-auth-gateway-2026-x9v2-pl7q-a84m')

@app.route('/api/admin-data')
def get_admin_data():
    if 'admin' not in session: return jsonify({"status": "unauthorized"}), 401
    
    curr_user = users_col.find_one({"username": session['admin']['username']})
    
    if not curr_user: 
        session.clear()
        return jsonify({"status": "unauthorized", "message": "حسابك لم يعد متاحاً. يرجى تسجيل الدخول مجدداً."}), 401
        
    user_role = curr_user.get('role')
    
    if user_role == 'super_admin':
        subjects = list(subjects_col.find({}, {"_id": 0}))
        committees = list(committees_col.find({}, {"_id": 0}))
        complaints = list(complaints_col.find({}, {"_id": 0}))
        staff = list(users_col.find({"role": {"$ne": "super_admin"}}, {"_id": 0, "password": 0})) 
        students = list(students_col.find({}, {"_id": 0, "password": 0})) 
    else:
        allowed_subs = curr_user.get('allowed_subjects', [])
        subjects = list(subjects_col.find({"id": {"$in": allowed_subs}}, {"_id": 0}))
        committees = list(committees_col.find({"subject_id": {"$in": allowed_subs}}, {"_id": 0}))
        complaints = list(complaints_col.find({"subject_id": {"$in": allowed_subs}}, {"_id": 0}))
        students = []
        
        if user_role == 'doctor':
            staff = list(users_col.find({"role": "ta"}, {"_id": 0, "password": 0}))
            for s in staff:
                s['allowed_subjects'] = [sub for sub in s.get('allowed_subjects', []) if sub in allowed_subs]
        else:
            staff = []

    system_open = check_system_open()
    
    return jsonify({
        "subjects": subjects, 
        "committees": committees, 
        "staff": staff, 
        "complaints": complaints,
        "students": students,
        "currentAdmin": session['admin'],
        "system_open": system_open
    })

@app.route('/api/admin-action', methods=['POST'])
def admin_action():
    if 'admin' not in session: return jsonify({"status": "unauthorized", "message": "انتهت الجلسة"}), 401
    
    curr_db = users_col.find_one({"username": session['admin']['username']})
    if not curr_db:
        session.clear()
        return jsonify({"status": "unauthorized", "message": "حسابك لم يعد متاحاً."}), 401
        
    data = request.json
    action = str(data.get('action', ''))
    curr = session['admin']
    role = curr_db.get('role')
    
    if action == 'toggle_system' and role == 'super_admin':
        is_open = bool(data.get('is_open'))
        settings_col.update_one({"type": "system_status"}, {"$set": {"is_open": is_open}})
        global SYSTEM_IS_OPEN_CACHE
        SYSTEM_IS_OPEN_CACHE = is_open
        return jsonify({"status": "success"})

    elif action == 'toggle_subject_complaints':
        if role == 'ta': 
            return jsonify({"status": "error", "message": "غير مصرح للمعيدين بإيقاف استقبال الشكاوى!"}), 403
            
        sub_id = str(data.get('subject_id', ''))
        if role == 'doctor' and sub_id not in curr_db.get('allowed_subjects', []):
            return jsonify({"status": "error", "message": "غير مصرح لك بتعديل هذه المادة!"}), 403

        subjects_col.update_one({"id": sub_id}, {"$set": {"complaints_open": bool(data.get('is_open'))}})
        return jsonify({"status": "success"})

    elif action == 'change_my_password':
        new_pw = generate_password_hash(str(data.get('new_password', '')))
        users_col.update_one({"username": curr['username']}, {"$set": {"password": new_pw}})
        return jsonify({"status": "success"})

    elif action == 'change_password':
        target_user = str(data.get('target_user', ''))
        new_password = generate_password_hash(str(data.get('new_password', '')))
        
        target_db = users_col.find_one({"username": target_user})
        if not target_db: return jsonify({"status": "error", "message": "المستخدم غير موجود!"}), 404
        
        if role != 'super_admin' and target_db.get('created_by') != curr['username']:
            return jsonify({"status": "error", "message": "غير مصرح لك بتغيير كلمة مرور هذا المستخدم!"}), 403
            
        users_col.update_one({"username": target_user}, {"$set": {"password": new_password}})
        return jsonify({"status": "success"})

    elif action == 'manage_subject':
        if role != 'super_admin':
            return jsonify({"status": "error", "message": "غير مصرح لك بإدارة المواد!"}), 403
            
        sub_action = str(data.get('sub', ''))
        if sub_action == 'add': 
            subject_data = data.get('subject', {})
            subjects_col.insert_one({**subject_data, "added_by": curr['name']})
        elif sub_action == 'edit':
            subject_data = data.get('subject', {})
            update_data = {
                "name": str(subject_data.get('name', '')),
                "year": str(subject_data.get('year', '')),
                "department": str(subject_data.get('department', ''))
            }
            if 'image' in subject_data:
                update_data['image'] = str(subject_data.get('image', ''))
                
            subjects_col.update_one({"id": str(subject_data.get('id', ''))}, {"$set": update_data})
        elif sub_action == 'delete':
            sub_id = str(data.get('id', ''))
            subjects_col.delete_one({"id": sub_id})
            committees_col.delete_many({"subject_id": sub_id})
            
    elif action == 'manage_student':
        if role != 'super_admin': return jsonify({"status": "error", "message": "غير مصرح لك!"}), 403
        
        sub_action = str(data.get('sub', ''))
        if sub_action == 'add_bulk':
            year = str(data.get('year', ''))
            dept = str(data.get('dept', ''))
            raw_lines = str(data.get('raw_data', '')).strip().split('\n')
            inserted_count = 0
            
            for line in raw_lines:
                parts = line.split(',')
                if len(parts) >= 3:
                    s_name = parts[0].strip()
                    s_id = parts[1].strip()
                    s_pass = parts[2].strip()
                    s_email = f"{s_id}@batechu.com"
                    
                    if len(s_id) == 7 and s_id.isdigit():
                        students_col.update_one(
                            {"student_id": s_id},
                            {"$set": {
                                "name": s_name,
                                "student_id": s_id,
                                "email": s_email,
                                "password": generate_password_hash(s_pass), 
                                "year": year,
                                "department": dept
                            }},
                            upsert=True
                        )
                        inserted_count += 1
            return jsonify({"status": "success", "message": f"تم إضافة/تحديث {inserted_count} طالب بنجاح."})
            
        elif sub_action == 'edit':
            old_id = str(data.get('old_id', ''))
            s_name = str(data.get('name', ''))
            s_id = str(data.get('student_id', ''))
            s_pass = str(data.get('password', ''))
            year = str(data.get('year', ''))
            dept = str(data.get('dept', ''))
            s_email = f"{s_id}@batechu.com"
            
            if old_id != s_id and students_col.find_one({"student_id": s_id}):
                return jsonify({"status": "error", "message": "رقم الـ ID الجديد مستخدم بالفعل لطالب آخر!"}), 400
                
            update_fields = {
                "name": s_name,
                "student_id": s_id,
                "email": s_email,
                "year": year,
                "department": dept
            }
            if s_pass: 
                update_fields["password"] = generate_password_hash(s_pass)
                
            students_col.update_one({"student_id": old_id}, {"$set": update_fields})
            return jsonify({"status": "success"})

        elif sub_action == 'delete':
            students_col.delete_one({"student_id": str(data.get('student_id', ''))})
            return jsonify({"status": "success"})
            
        elif sub_action == 'wipe_filter':
            students_col.delete_many({"year": str(data.get('year', '')), "department": str(data.get('dept', ''))})
            return jsonify({"status": "success"})

    elif action == 'manage_committee':
        sub_action = str(data.get('sub', ''))
        if sub_action == 'add':
            com_data = data.get('committee', {})
            clean_ids = list(set(re.findall(r'\b\d{7}\b', str(com_data.get('raw_ids', '')))))
            unique_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            sub_id = str(com_data.get('subject_id', ''))
            committees_col.insert_one({
                "committee_id": f"COM_{unique_str}_{sub_id}",
                "subject_id": sub_id,
                "committee_name": str(com_data.get('name', '')),
                "ids": clean_ids, "added_by": curr['name']
            })
        elif sub_action == 'delete': committees_col.delete_one({"committee_id": str(data.get('id', ''))})

    elif action == 'wipe_subject_committees':
        if role != 'super_admin': 
            return jsonify({"status": "error", "message": "غير مصرح لك بمسح اللجان!"}), 403
        committees_col.delete_many({"subject_id": str(data.get('subject_id', ''))})
        return jsonify({"status": "success"})

    elif action == 'wipe_subject_complaints':
        if role != 'super_admin': 
            return jsonify({"status": "error", "message": "غير مصرح لك بمسح الشكاوى!"}), 403
        complaints_col.delete_many({"subject_id": str(data.get('subject_id', '')), "status": str(data.get('status', ''))})
        return jsonify({"status": "success"})

    elif action == 'manage_staff':
        if role == 'ta': return jsonify({"status": "error", "message": "المعيد ليس له صلاحية إدارة طاقم"}), 403
        
        sub_action = str(data.get('sub', ''))
        staff_data = data.get('staff', {})
        
        if sub_action == 'add':
            new_role = str(staff_data.get('role', 'ta'))
            allowed_subs = staff_data.get('allowed_subjects', [])
            
            if role == 'doctor':
                new_role = 'ta'
                my_subs = curr_db.get('allowed_subjects', [])
                if not all(s in my_subs for s in allowed_subs):
                    return jsonify({"status": "error", "message": "لا يمكنك إعطاء صلاحية لمعيد في مادة لا تدرسها أنت!"}), 403
                    
            target_user = str(staff_data.get('username', ''))
            if not users_col.find_one({"username": target_user}): 
                users_col.insert_one({
                    "name": str(staff_data.get('name', '')),
                    "username": target_user,
                    "password": generate_password_hash(str(staff_data.get('password', ''))),
                    "role": new_role,
                    "allowed_subjects": allowed_subs,
                    "created_by": curr['username']
                })
            else: return jsonify({"status": "error", "message": "اسم المستخدم موجود بالفعل!"}), 400
            
        elif sub_action == 'edit':
            target_username = str(data.get('old_username', ''))
            target = users_col.find_one({"username": target_username})
            
            if not target: return jsonify({"status": "error", "message": "المستخدم غير موجود!"}), 404
                
            new_role = str(staff_data.get('role', target.get('role')))
            allowed_subs = staff_data.get('allowed_subjects', target.get('allowed_subjects', []))
            
            if role == 'doctor':
                new_role = 'ta'
                my_subs = curr_db.get('allowed_subjects', [])
                if not all(s in my_subs for s in allowed_subs):
                    return jsonify({"status": "error", "message": "لا يمكنك إعطاء صلاحية لمعيد في مادة لا تدرسها أنت!"}), 403

                target_existing_subs = target.get('allowed_subjects', [])
                subs_not_mine = [s for s in target_existing_subs if s not in my_subs]
                final_allowed_subs = subs_not_mine + allowed_subs
            else:
                final_allowed_subs = allowed_subs

            is_owner = (role == 'super_admin') or (target.get('created_by') == curr['username'])
            new_username = str(staff_data.get('username', target_username))

            if is_owner:
                if new_username != target_username and users_col.find_one({"username": new_username}):
                    return jsonify({"status": "error", "message": "اسم المستخدم الجديد مستخدم بالفعل!"}), 400

                old_name = target.get('name')
                new_name = str(staff_data.get('name', old_name))

                update_fields = {
                    "name": new_name,
                    "username": new_username,
                    "role": new_role,
                    "allowed_subjects": final_allowed_subs
                }
                
                raw_new_pass = str(staff_data.get('password', '')).strip()
                if raw_new_pass != '':
                    update_fields['password'] = generate_password_hash(raw_new_pass)

                users_col.update_one({"username": target_username}, {"$set": update_fields})

                if old_name != new_name:
                    subjects_col.update_many({"added_by": old_name}, {"$set": {"added_by": new_name}})
                    committees_col.update_many({"added_by": old_name}, {"$set": {"added_by": new_name}})
                    complaints_col.update_many({"replied_by": old_name}, {"$set": {"replied_by": new_name}})
                    
                if target_username != new_username:
                    users_col.update_many({"created_by": target_username}, {"$set": {"created_by": new_username}})
                    if target_username == curr['username']:
                        session['admin']['username'] = new_username
                
                if old_name != new_name and target_username == curr['username']:
                     session['admin']['name'] = new_name
            else:
                update_fields = {"allowed_subjects": final_allowed_subs}
                users_col.update_one({"username": target_username}, {"$set": update_fields})

        elif sub_action == 'delete': 
            target_username = str(data.get('username', ''))
            target = users_col.find_one({"username": target_username})
            if not target: return jsonify({"status": "error", "message": "المستخدم غير موجود"}), 404
            
            if role == 'doctor':
                if target.get('created_by') != curr['username']:
                    return jsonify({"status": "error", "message": "لا يمكنك حذف هذا المعيد نهائياً لأنك لست من قمت بإنشائه! يمكنك فقط إزالته من موادك عبر تعديل الصلاحيات."}), 403
                
                target_subs = target.get('allowed_subjects', [])
                my_subs = curr_db.get('allowed_subjects', [])
                remaining = [s for s in target_subs if s not in my_subs]
                if len(remaining) > 0:
                    return jsonify({"status": "error", "message": "لا يمكنك حذف المعيد نهائياً لأنه أصبح مرتبطاً بمواد دكاترة آخرين! يرجى إزالة صلاحياته من موادك فقط."}), 403
            
            users_col.delete_one({"username": target_username})
            
    elif action == 'reply_complaint':
        complaints_col.update_one(
            {"tracking_id": str(data.get('tracking_id', ''))}, 
            {"$set": {
                "status": "resolved", 
                "admin_reply": str(data.get('reply', '')), 
                "replied_by": curr['name'],
                "audio_record": str(data.get('audio_record', ''))
            }}
        )
    elif action == 'mark_spam':
        complaints_col.update_one({"tracking_id": str(data.get('tracking_id', ''))}, {"$set": {"status": "spam"}})
    elif action == 'restore_complaint':
        complaints_col.update_one({"tracking_id": str(data.get('tracking_id', ''))}, {"$set": {"status": "pending"}})
    elif action == 'delete_complaint':
        complaints_col.delete_one({"tracking_id": str(data.get('tracking_id', ''))})
        
    elif action == 'wipe_all' and role == 'super_admin':
        admin_user = users_col.find_one({"username": curr['username']})
        provided_pw = str(data.get('admin_password', ''))
        if admin_user and check_password_hash(admin_user.get('password'), provided_pw):
            subjects_col.delete_many({})
            committees_col.delete_many({})
            complaints_col.delete_many({})
            students_col.delete_many({})
            return jsonify({"status": "success", "message": "تم تدمير جميع بيانات النظام بنجاح"})
        else:
            return jsonify({"status": "error", "message": "كلمة المرور غير صحيحة، تم إحباط العملية"}), 401
            
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
