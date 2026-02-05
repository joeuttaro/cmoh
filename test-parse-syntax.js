#!/usr/bin/env node

/**
 * Test script to verify parse.js syntax is correct
 * This will import the module to check for syntax errors
 */

async function test() {
  try {
    console.log('Testing parse.js syntax...');
    const parseModule = await import('./lib/parse.js');
    console.log('✓ parse.js imported successfully');
    console.log('✓ No syntax errors found');
    
    // Test that functions exist
    if (typeof parseModule.parseSchedule === 'function') {
      console.log('✓ parseSchedule function exists');
    } else {
      console.error('❌ parseSchedule function not found');
      process.exit(1);
    }
    
    if (typeof parseModule.normalizeOpponent === 'function') {
      console.log('✓ normalizeOpponent function exists');
    } else {
      console.error('❌ normalizeOpponent function not found');
      process.exit(1);
    }
    
    console.log('\n✅ All syntax checks passed!');
  } catch (error) {
    console.error('❌ Syntax error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
