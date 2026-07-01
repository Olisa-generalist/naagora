// api/withdraw.js
// ─────────────────────────────────────────────
// Vercel Serverless Function — handles bank withdrawals.
// This is the ONLY place the Paystack SECRET key is used —
// never expose it in frontend code.
//
// Flow:
// 1. Verify the user's wallet has sufficient balance
// 2. Create a Paystack transfer recipient (if not already saved)
// 3. Initiate the transfer via Paystack
// 4. Debit the wallet only after Paystack confirms
// 5. Log the withdrawal in Supabase
//
// Deploy: this file auto-deploys as /api/withdraw on Vercel,
// no extra config needed since it's already in /api folder.
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, amount, bankCode, accountNumber, accountName, bankName } = req.body

  if (!userId || !amount || !bankCode || !accountNumber) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Use service role key to bypass RLS for this trusted server-side operation
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Step 1: Check wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single()

    if (walletError || !wallet) {
      return res.status(404).json({ error: 'Wallet not found' })
    }
    if (Number(wallet.balance) < Number(amount)) {
      return res.status(400).json({ error: 'Insufficient balance' })
    }

    // Step 2: Create Paystack transfer recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'nuban',
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      }),
    })
    const recipientData = await recipientRes.json()

    if (!recipientData.status) {
      return res.status(400).json({ error: recipientData.message || 'Could not verify bank account' })
    }

    const recipientCode = recipientData.data.recipient_code

    // Step 3: Initiate the transfer
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(Number(amount) * 100), // kobo
        recipient: recipientCode,
        reason: 'Naagora wallet withdrawal',
      }),
    })
    const transferData = await transferRes.json()

    if (!transferData.status) {
      return res.status(400).json({ error: transferData.message || 'Transfer failed' })
    }

    // Step 4: Debit wallet only after Paystack confirms transfer initiated
    const { data: debited } = await supabase.rpc('debit_wallet', {
      p_user_id: userId,
      p_amount: Number(amount),
    })

    if (!debited) {
      // Transfer was sent but wallet debit failed — log for manual review
      console.error('CRITICAL: Paystack transfer succeeded but wallet debit failed', { userId, amount })
    }

    // Step 5: Log the withdrawal
    await supabase.from('withdrawals').insert({
      user_id: userId,
      amount: Number(amount),
      bank_name: bankName,
      account_number: accountNumber,
      account_name: accountName,
      status: transferData.data.status === 'success' ? 'success' : 'processing',
      paystack_transfer_code: transferData.data.transfer_code,
      paystack_reference: transferData.data.reference,
      completed_at: transferData.data.status === 'success' ? new Date().toISOString() : null,
    })

    // Save recipient code for faster future withdrawals
    await supabase
      .from('users')
      .update({ paystack_recipient_code: recipientCode })
      .eq('id', userId)

    return res.status(200).json({
      success: true,
      status: transferData.data.status,
      reference: transferData.data.reference,
    })
  } catch (err) {
    console.error('Withdrawal error:', err)
    return res.status(500).json({ error: 'Withdrawal failed. Please try again or contact support.' })
  }
}
