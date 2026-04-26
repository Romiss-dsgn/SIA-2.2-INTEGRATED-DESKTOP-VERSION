// ====== REQUEST FORM → MEDTECH NOTIFICATION ======

// ✅ Trigger notification when doctor submits lab request (with real requestId from backend)
async function notifyMedtechNewRequest(realRequestId, formData) {
  try {
    const response = await fetch('http://localhost:5000/api/notifications/lab-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: realRequestId,
        patientName: formData.patientName,
        doctorName: formData.doctorName || sessionStorage.getItem('name') || 'Doctor',
        doctorId: sessionStorage.getItem('userId'),
        tests: formData.tests || [],
        priority: formData.priority || 'Routine'
      })
    });
    
    if (response.ok) {
      console.log('✅ Lab request notification sent to medtechs');
      return await response.json();
    } else {
      console.error('❌ Failed to send lab request notification');
    }
  } catch (err) {
    console.error('Error sending lab request notification:', err);
  }
}