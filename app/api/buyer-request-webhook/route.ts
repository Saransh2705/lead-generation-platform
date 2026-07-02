import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { error } = await supabaseAdmin.from('buyer_requests').insert({
      buyer_name: data.buyer_name,
      buyer_email: data.buyer_email,
      buyer_phone: data.buyer_phone || null,
      category_wanted: data.category_wanted,
      quantity_wanted: parseInt(data.quantity_wanted) || null,
      price_offered: parseFloat(data.price_offered) || null,
      notes: data.notes || null,
    });

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Failed to save request' }, { status: 500 });
  }
}
