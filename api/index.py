from flask import Flask, render_template, request, jsonify, session, redirect
from pymongo import MongoClient
import re
import random
import string

app = Flask(__name__, template_folder='../templates')
app.secret_key = "DR_SELEM_VIP_SECURE_2026"

# اتصال قاعدة البيانات
MONGO_URI = "mongodb+srv://admin:admin1312312313@aws.rhgcybe.mongodb.net/?appName=aws"
client = MongoClient(MONGO_URI)
db = client['university_system']

users_col = db['users']              
subjects_col = db['subjects']        
committees_col = db['committees']    
complaints_col = db['complaints']    
settings_col = db['settings']

# إنشاء حساب الدكتور (Super Admin) الافتراضي إذا لم يكن موجوداً
if not users_col.find_one({"role": "super_admin"}):
    users_col.insert_one({"username": "admin", "password": "123", "name": "DR. Mohamed Selem", "role": "super_admin"})

# إنشاء إعدادات النظام الافتراضية (مفتوح)
if not settings_col.find_one({"type": "system_status"}):
    settings_col.insert_one({"type": "system_status", "is_open": True})

def check_system_open():
    status = settings_col.find_one({"type": "system_status"})
    return status.get('is_open', True) if status else True

def generate_tracking_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

@app.route('/')
def index():
    if not check_system_open():
        return """<!doctype html>
<html lang=en>
<title>404 Not Found</title>
<h1>Not Found</h1>
<p>The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.</p>
</html>""", 404
    return render_template('index.html')

@app.route('/api/get-subjects')
def get_subjects():
    if not check_system_open(): return jsonify({"status": "error", "message": "System Closed"}), 403
    subjects = list(subjects_col.find({}, {"_id": 0}))
    return jsonify({"subjects": subjects})

@app.route('/api/check-id', methods=['POST'])
def check_id():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    data = request.json
    subject_id = data.get('subject_id')
    student_id = str(data.get('student_id')).strip()
    
    if len(student_id) != 7 or not student_id.isdigit():
        return jsonify({"status": "error", "message": "رقم الـ ID يجب أن يكون 7 أرقام فقط"}), 400
        
    committee = committees_col.find_one({"subject_id": subject_id, "ids": student_id})
    if committee:
        return jsonify({"status": "success", "committee_name": committee['committee_name']})
    else:
        return jsonify({"status": "error", "message": "لم يتم العثور على هذا الـ ID في هذه المادة. تأكد من الرقم."})

@app.route('/api/submit-complaint', methods=['POST'])
def submit_complaint():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    data = request.json
    tracking_id = generate_tracking_id()
    
    complaints_col.insert_one({
        "tracking_id": tracking_id,
        "subject_id": data['subject_id'],
        "subject_name": data['subject_name'],
        "student_id": data['student_id'],
        "student_name": data['student_name'],
        "assigned_committee": data['assigned_committee'],
        "actual_committee": data['actual_committee'],
        "problem": data['problem'][:100], 
        "status": "pending",
        "admin_reply": ""
    })
    return jsonify({"status": "success", "tracking_id": tracking_id})

@app.route('/api/track-complaint', methods=['POST'])
def track_complaint():
    if not check_system_open(): return jsonify({"status": "error", "message": "النظام مغلق حالياً."}), 403
    tracking_id = request.json.get('tracking_id').strip().upper()
    complaint = complaints_col.find_one({"tracking_id": tracking_id}, {"_id": 0})
    if complaint: return jsonify({"status": "success", "complaint": complaint})
    return jsonify({"status": "error", "message": "رقم التتبع غير صحيح أو غير موجود."})

# =========================================================
# رابط الدخول السري والمعقد (مستحيل التخمين بأدوات الفحص)
# =========================================================
@app.route('/auth-gateway-vip-x9v2-pL7q-2026', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = users_col.find_one({"username": request.json.get('username'), "password": request.json.get('password')})
        if user:
            session['admin'] = {"username": user['username'], "role": user['role'], "name": user['name']}
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "بيانات الدخول غير صحيحة"}), 401
    return render_template('admin.html')

@app.route('/logout-gateway-vip-x9v2-pL7q-2026')
def logout():
    session.clear()
    return redirect('/auth-gateway-vip-x9v2-pL7q-2026')

@app.route('/api/admin-data')
def get_admin_data():
    if 'admin' not in session: return jsonify({"status": "unauthorized"}), 401
    
    curr_user = users_col.find_one({"username": session['admin']['username']})
    is_super_admin = curr_user.get('role') == 'super_admin'
    
    if is_super_admin:
        subjects = list(subjects_col.find({}, {"_id": 0}))
        committees = list(committees_col.find({}, {"_id": 0}))
        complaints = list(complaints_col.find({}, {"_id": 0}))
    else:
        allowed_subs = curr_user.get('allowed_subjects', [])
        subjects = list(subjects_col.find({"id": {"$in": allowed_subs}}, {"_id": 0}))
        committees = list(committees_col.find({"subject_id": {"$in": allowed_subs}}, {"_id": 0}))
        complaints = list(complaints_col.find({"subject_id": {"$in": allowed_subs}}, {"_id": 0}))

    staff = list(users_col.find({}, {"_id": 0, "password": 0}))
    system_open = check_system_open()
    
    return jsonify({
        "subjects": subjects, 
        "committees": committees, 
        "staff": staff, 
        "complaints": complaints, 
        "currentAdmin": session['admin'],
        "system_open": system_open
    })

@app.route('/api/admin-action', methods=['POST'])
def admin_action():
    if 'admin' not in session: return jsonify({"status": "unauthorized"}), 403
    
    data = request.json
    action = data.get('action')
    curr = session['admin']
    
    if action == 'toggle_system' and curr['role'] == 'super_admin':
        settings_col.update_one({"type": "system_status"}, {"$set": {"is_open": data['is_open']}})
        return jsonify({"status": "success"})

    elif action == 'change_password':
        target_user = data.get('target_user')
        new_password = data.get('new_password')
        
        if curr['role'] != 'super_admin' and curr['username'] != target_user:
            return jsonify({"status": "error", "message": "غير مصرح لك بتغيير كلمة مرور هذا المستخدم!"}), 403
            
        users_col.update_one({"username": target_user}, {"$set": {"password": new_password}})
        return jsonify({"status": "success"})

    elif action == 'manage_subject':
        if curr['role'] != 'super_admin':
            return jsonify({"status": "error", "message": "غير مصرح لك بإدارة المواد!"}), 403
            
        if data['sub'] == 'add': subjects_col.insert_one({**data['subject'], "added_by": curr['name']})
        elif data['sub'] == 'delete':
            subjects_col.delete_one({"id": data['id']})
            committees_col.delete_many({"subject_id": data['id']})
            
    elif action == 'manage_committee':
        if data['sub'] == 'add':
            clean_ids = list(set(re.findall(r'\b\d{7}\b', data['committee']['raw_ids'])))
            committees_col.insert_one({
                "committee_id": "COM_" + str(len(clean_ids)) + "_" + data['committee']['subject_id'],
                "subject_id": data['committee']['subject_id'],
                "committee_name": data['committee']['name'],
                "ids": clean_ids, "added_by": curr['name']
            })
        elif data['sub'] == 'delete': committees_col.delete_one({"committee_id": data['id']})
            
    elif action == 'manage_staff' and curr['role'] == 'super_admin':
        if data['sub'] == 'add':
            if not users_col.find_one({"username": data['staff']['username']}): 
                users_col.insert_one({
                    "name": data['staff']['name'],
                    "username": data['staff']['username'],
                    "password": data['staff']['password'],
                    "role": "admin",
                    "allowed_subjects": data['staff'].get('allowed_subjects', []) 
                })
            else: return jsonify({"status": "error", "message": "اسم المستخدم موجود بالفعل!"}), 400
        elif data['sub'] == 'delete': users_col.delete_one({"username": data['username']})
            
    elif action == 'reply_complaint':
        complaints_col.update_one({"tracking_id": data['tracking_id']}, {"$set": {"status": "resolved", "admin_reply": data['reply'], "replied_by": curr['name']}})
    elif action == 'mark_spam':
        complaints_col.update_one({"tracking_id": data['tracking_id']}, {"$set": {"status": "spam"}})
    elif action == 'restore_complaint':
        complaints_col.update_one({"tracking_id": data['tracking_id']}, {"$set": {"status": "pending"}})
    elif action == 'delete_complaint':
        complaints_col.delete_one({"tracking_id": data['tracking_id']})
        
    elif action == 'wipe_all' and curr['role'] == 'super_admin':
        admin_user = users_col.find_one({"username": curr['username']})
        if admin_user and admin_user.get('password') == data.get('admin_password'):
            subjects_col.delete_many({})
            committees_col.delete_many({})
            complaints_col.delete_many({})
            return jsonify({"status": "success", "message": "تم تدمير جميع بيانات النظام بنجاح"})
        else:
            return jsonify({"status": "error", "message": "كلمة المرور غير صحيحة، تم إحباط العملية"}), 401
            
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(port=8080)