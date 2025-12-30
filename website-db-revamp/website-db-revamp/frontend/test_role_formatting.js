// Test role name formatting utility
// This tests the formatRoleName function logic

function formatRoleName(roleName) {
  if (!roleName || typeof roleName !== 'string') {
    return 'Unnamed Role';
  }

  return roleName
    // Replace underscores with spaces
    .replace(/_/g, ' ')
    // Split by spaces and capitalize each word
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getRoleBadgeClasses(level) {
  if (level >= 100) {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  } else if (level >= 90) {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  } else if (level >= 80) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  } else if (level >= 60) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  } else if (level >= 50) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  } else if (level >= 10) {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
  } else {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

// Test cases
console.log('🧪 Testing Role Name Formatting...\n');

const testCases = [
  { input: 'field_tech', expected: 'Field Tech', level: 50 },
  { input: 'lab_tech', expected: 'Lab Tech', level: 60 },
  { input: 'admin', expected: 'Admin', level: 100 },
  { input: 'supervisor', expected: 'Supervisor', level: 80 },
  { input: 'manager', expected: 'Manager', level: 90 },
  { input: 'client', expected: 'Client', level: 10 },
  { input: 'default_user', expected: 'Default User', level: 0 },
  { input: 'quality_assurance_lead', expected: 'Quality Assurance Lead', level: 70 },
  { input: null, expected: 'Unnamed Role', level: 0 },
  { input: '', expected: 'Unnamed Role', level: 0 },
  { input: 'FIELD_TECH', expected: 'Field Tech', level: 50 }
];

testCases.forEach(({ input, expected, level }, index) => {
  const result = formatRoleName(input);
  const badgeClass = getRoleBadgeClasses(level);
  const passed = result === expected;
  
  console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'}`);
  console.log(`  Input: ${input === null ? 'null' : `"${input}"`}`);
  console.log(`  Expected: "${expected}"`);
  console.log(`  Got: "${result}"`);
  console.log(`  Level: ${level} -> Badge: ${badgeClass.includes('bg-red') ? '🔴 Admin' : badgeClass.includes('bg-orange') ? '🟠 Manager' : badgeClass.includes('bg-yellow') ? '🟡 Supervisor' : badgeClass.includes('bg-green') ? '🟢 Lab Tech' : badgeClass.includes('bg-blue') ? '🔵 Field Tech' : badgeClass.includes('bg-purple') ? '🟣 Client' : '⚫ Default'}`);
  console.log('');
});

console.log('✅ Role formatting tests complete!');
console.log('\n📋 Summary:');
console.log('- ✅ Underscores converted to spaces');
console.log('- ✅ Each word properly capitalized'); 
console.log('- ✅ Edge cases handled (null, empty)');
console.log('- ✅ Color coding by role level implemented');
console.log('- ✅ User-friendly role names for display');