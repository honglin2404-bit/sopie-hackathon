import 'dotenv/config'
import { generateEmbedding } from '../lib/openai'
import { supabaseAdmin } from '../lib/supabase'

async function testEmbeddingAndInsert() {
  try {
    console.log('🚀 Testing OpenAI Embedding + Supabase Insert...\n')

    // Sample SOP data
    const sampleSOP = {
      title: 'Cách xử lý lỗi xác thực NFC CIMB',
      domain: 'Account',
      category: 'Authentication',
      content: `
        Khi khách hàng gặp lỗi "Xác thực NFC CIMB thất bại", CS cần làm theo các bước sau:
        1. Kiểm tra khách hàng đã bật NFC trên điện thoại chưa
        2. Hướng dẫn khách chụp lại mặt trước CCCD/CMND
        3. Đảm bảo ảnh rõ nét, không bị mờ
        4. Nếu vẫn lỗi, escalate lên Team Lead để check hệ thống CIMB
      `,
      summary: 'Hướng dẫn xử lý lỗi xác thực NFC CIMB cho khách hàng',
      tags: ['NFC', 'CIMB', 'Authentication', 'Account'],
      status: 'published'
    }

    // Step 1: Insert SOP metadata
    console.log('📝 Inserting SOP metadata...')
    const { data: sop, error: sopError } = await supabaseAdmin
      .from('sops')
      .insert(sampleSOP)
      .select()
      .single()

    if (sopError) throw sopError
    console.log('✅ SOP inserted:', sop.id)

    // Step 2: Generate embedding
    console.log('\n🤖 Generating embedding with OpenAI...')
    const textToEmbed = `${sampleSOP.title}\n${sampleSOP.content}`
    const embedding = await generateEmbedding(textToEmbed)
    console.log('✅ Embedding generated:', embedding.length, 'dimensions')

    // Step 3: Insert embedding
    console.log('\n💾 Inserting embedding to Supabase...')
    const { error: embeddingError } = await supabaseAdmin
      .from('sop_embeddings')
      .insert({
        sop_id: sop.id,
        embedding: embedding
      })

    if (embeddingError) throw embeddingError
    console.log('✅ Embedding inserted!')

    console.log('\n🎉 Test completed successfully!')
    console.log('SOP ID:', sop.id)
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testEmbeddingAndInsert()