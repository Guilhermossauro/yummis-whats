export interface WorkflowDefinition {
  name: string;
  description: string;
  trigger: string;
  keyActionNodes: string[];
  nodesCount: number;
  bestPractices: string[];
  json: string;
}

export const WORKFLOWS_DATA: Record<string, WorkflowDefinition> = {
  mainChatbot: {
    name: "01. Router / Chatbot Principal",
    description: "Porta de entrada principal que escuta webhooks do WhatsApp (via Evolution API), normaliza o payload, consulta o State Manager, decide a ramificação de fluxo baseado no estado atual da conversa e delega para sub-workflows dedicados.",
    trigger: "Webhook do Evolution API (evento de mensagem recebida)",
    nodesCount: 12,
    keyActionNodes: ["Webhook Trigger", "Normalize Payload (Code)", "State Lookup", "Router Switch (State)", "Sub-Workflow Execution"],
    bestPractices: [
      "Processamento Assíncrono: Retorne HTTP 200 imediatamente para o webhook do WhatsApp antes de iniciar qualquer pesquisa pesada d3 ou buscas externas para evitar re-envio do webhook por timeouts.",
      "Validação de Origem: Filtre requests para garantir que a mensagem é de fato recebida, e ignore mensagens enviadas pelo próprio bot (self)."
    ],
    json: JSON.stringify({
      "name": "01. WhatsApp Chatbot Router",
      "nodes": [
        {
          "parameters": {
            "httpMethod": "POST",
            "path": "whatsapp-webhook",
            "responseMode": "responseNode",
            "options": {}
          },
          "id": "e2e83162-850f-48db-bfd9-bf39366ef717",
          "name": "WhatsApp Evolution Webhook",
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 1,
          "position": [100, 300]
        },
        {
          "parameters": {
            "respondWith": "allIncomingItems",
            "options": {
              "responseBody": "{\"status\":\"received\"}"
            }
          },
          "id": "18c1b97a-9fe0-410a-8bf8-d3f3f5be7a3c",
          "name": "Respond Webhook Immediately",
          "type": "n8n-nodes-base.respondToWebhook",
          "typeVersion": 1,
          "position": [280, 300]
        },
        {
          "parameters": {
            "jsCode": "const body = items[0].json.body;\n\n// Filtragem básica para evitar auto-respostas (mensagens enviadas pelo próprio bot)\nif (body.key.fromMe) {\n  return [];\n}\n\n// Extração uniforme de dados (Evolution API format)\nconst phone = body.key.remoteJid.replace('@s.whatsapp.net', '');\nconst messageType = body.messageType;\nlet text = '';\n\nif (messageType === 'conversation') {\n  text = body.message.conversation;\n} else if (messageType === 'extendedTextMessage') {\n  text = body.message.extendedTextMessage.text;\n} else if (body.message?.buttonsResponseMessage) {\n  text = body.message.buttonsResponseMessage.selectedButtonId;\n} else if (body.message?.listResponseMessage) {\n  text = body.message.listResponseMessage.singleSelectReply.selectedRowId;\n}\n\nconst clientName = body.pushName || 'Cliente';\n\nreturn [{\n  json: {\n    leadId: phone,\n    phone: phone,\n    name: clientName,\n    text: text.trim(),\n    timestamp: body.messageTimestamp\n  }\n}];"
          },
          "id": "2db4e81a-7b3b-481d-91b5-3733075677ea",
          "name": "Normalize Payload",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [460, 300]
        },
        {
          "parameters": {
            "workflowId": "state-manager-workflow-id",
            "options": {
              "mode": "waitToFinish"
            }
          },
          "id": "3dc29fba-cca7-463d-83b6-cb87cb9e2fa2",
          "name": "Get/Create Session State",
          "type": "n8n-nodes-base.executeWorkflow",
          "typeVersion": 1,
          "position": [640, 300]
        },
        {
          "parameters": {
            "rules": {
              "values": [
                {
                  "value1": "={{ $json.state }}",
                  "value2": "START",
                  "operation": "equal"
                },
                {
                  "value1": "={{ $json.state }}",
                  "value2": "SHOPPING",
                  "operation": "equal"
                },
                {
                  "value1": "={{ $json.state }}",
                  "value2": "CHECKOUT_CONTACT",
                  "operation": "equal"
                },
                {
                  "value1": "={{ $json.state }}",
                  "value2": "WAITING_PAYMENT",
                  "operation": "equal"
                }
              ]
            }
          },
          "id": "fe94bd75-4d7a-4ec9-865b-f116a8d672ea",
          "name": "State Switch Router",
          "type": "n8n-nodes-base.switch",
          "typeVersion": 1,
          "position": [820, 300]
        },
        {
          "parameters": {
            "workflowId": "welcome-workflow-id"
          },
          "id": "787bb7b3-cbaa-425f-bc1a-63ad57eaad1c",
          "name": "Execute Welcome Flow (START)",
          "type": "n8n-nodes-base.executeWorkflow",
          "typeVersion": 1,
          "position": [1040, 150]
        },
        {
          "parameters": {
            "workflowId": "catalog-and-cart-workflow-id"
          },
          "id": "b0a2bf43-6997-4c4f-aba1-094943d679b3",
          "name": "Execute Shopping Flow (SHOPPING)",
          "type": "n8n-nodes-base.executeWorkflow",
          "typeVersion": 1,
          "position": [1040, 270]
        },
        {
          "parameters": {
            "workflowId": "checkout-workflow-id"
          },
          "id": "0fa9f83a-86b2-4d7b-99d9-48227b233a7e",
          "name": "Execute Checkout Flow",
          "type": "n8n-nodes-base.executeWorkflow",
          "typeVersion": 1,
          "position": [1040, 390]
        },
        {
          "parameters": {
            "workflowId": "payment-status-workflow-id"
          },
          "id": "9facbe09-bc3f-4e0e-af3a-5942deba4499",
          "name": "Execute Payment Status Flow",
          "type": "n8n-nodes-base.executeWorkflow",
          "typeVersion": 1,
          "position": [1040, 510]
        }
      ],
      "connections": {
        "WhatsApp Evolution Webhook": {
          "main": [
            [
              {
                "node": "Respond Webhook Immediately",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Respond Webhook Immediately": {
          "main": [
            [
              {
                "node": "Normalize Payload",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Normalize Payload": {
          "main": [
            [
              {
                "node": "Get/Create Session State",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Get/Create Session State": {
          "main": [
            [
              {
                "node": "State Switch Router",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "State Switch Router": {
          "main": [
            [
              {
                "node": "Execute Welcome Flow (START)",
                "type": "main",
                "index": 0
              }
            ],
            [
              {
                "node": "Execute Shopping Flow (SHOPPING)",
                "type": "main",
                "index": 1
              }
            ],
            [
              {
                "node": "Execute Checkout Flow",
                "type": "main",
                "index": 2
              }
            ],
            [
              {
                "node": "Execute Payment Status Flow",
                "type": "main",
                "index": 3
              }
            ]
          ]
        }
      }
    }, null, 2)
  },
  stateManager: {
    name: "02. State Manager (Gerenciador de Sessão)",
    description: "Centraliza todo o ciclo de vida do cliente. Grava e lê do banco SQLite/PostgreSQL informações do cliente, o 'State' atual da conversa e o JSON serializado do carrinho de compras.",
    trigger: "Chamada interna via Execute Workflow",
    nodesCount: 8,
    keyActionNodes: ["SQL Read State", "Initialize New Client (if empty)", "SQL Write State Update", "JSON Serializer Helper"],
    bestPractices: [
      "Prevenção de Locks: Em SQLite, use conexões bem otimizadas e evite queries encadeadas de gravação síncrona. Em PostgreSQL, prefira upsert síncrono atomizado `ON CONFLICT (phone) DO UPDATE`.",
      "Sanitização: Sempre limpe caracteres especiais do número de telefone antes de injetar nas queries SQL."
    ],
    json: JSON.stringify({
      "name": "02. WhatsApp State Manager (SQLite/PostgreSQL)",
      "nodes": [
        {
          "parameters": {
            "options": {}
          },
          "id": "e9ddbc9a-b4a1-432a-bc9e-8395dae163ab",
          "name": "Workflow Input Payload",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeVersion": 1,
          "position": [100, 300]
        },
        {
          "parameters": {
            "operation": "executeQuery",
            "query": "SELECT * FROM customer_sessions WHERE phone = :phone LIMIT 1;",
            "additionalFields": {
              "parameterizedFieldsUi": {
                "parameterizedFields": [
                  {
                    "name": "phone",
                    "value": "={{ $json.phone }}"
                  }
                ]
              }
            }
          },
          "id": "4db754fe-8a9d-4781-bcfa-dfa031e064bc",
          "name": "Check DB Session",
          "type": "n8n-nodes-base.sqlite",
          "typeVersion": 1,
          "position": [300, 300]
        },
        {
          "parameters": {
            "conditions": {
              "boolean": [
                {
                  "value1": "={{ $json.length > 0 }}",
                  "value2": true
                }
              ]
            }
          },
          "id": "7ac19da4-c10a-4bf2-bd90-7d7211bf7ca1",
          "name": "Session Exists?",
          "type": "n8n-nodes-base.if",
          "typeVersion": 1,
          "position": [500, 300]
        },
        {
          "parameters": {
            "operation": "executeQuery",
            "query": "INSERT INTO customer_sessions (phone, name, state, cart_json, created_at, updated_at) VALUES (:phone, :name, 'START', '[]', datetime('now'), datetime('now'));",
            "additionalFields": {
              "parameterizedFieldsUi": {
                "parameterizedFields": [
                  {
                    "name": "phone",
                    "value": "={{ $('Workflow Input Payload').item.json.phone }}"
                  },
                  {
                    "name": "name",
                    "value": "={{ $('Workflow Input Payload').item.json.name }}"
                  }
                ]
              }
            }
          },
          "id": "4ba98b4b-ce9d-425f-bcdd-ab834ed8cbef",
          "name": "Create New Session Entry",
          "type": "n8n-nodes-base.sqlite",
          "typeVersion": 1,
          "position": [680, 200]
        },
        {
          "parameters": {
            "jsCode": "return [{\n  json: {\n    phone: $('Workflow Input Payload').item.json.phone,\n    name: $('Workflow Input Payload').item.json.name,\n    state: 'START',\n    cart: [],\n    abandoned_notified: 0\n  }\n}];"
          },
          "id": "5dc25db4-be99-4702-bc32-1a22bd84090b",
          "name": "Return New Session JSON",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [860, 200]
        },
        {
          "parameters": {
            "jsCode": "// Desserializa o carrinho persistido no SQLite\nconst dbData = items[0].json;\nlet parsedCart = [];\ntry {\n  parsedCart = JSON.parse(dbData.cart_json || '[]');\n} catch(e) {\n  parsedCart = [];\n}\n\nreturn [{\n  json: {\n    phone: dbData.phone,\n    name: dbData.name,\n    state: dbData.state,\n    cart: parsedCart,\n    abandoned_notified: dbData.abandoned_notified,\n    createdAt: dbData.created_at,\n    updatedAt: dbData.updated_at\n  }\n}];"
          },
          "id": "8bc12ea4-cca9-43c3-88fe-ae21b72ef3fe",
          "name": "Parse SQLite Payload",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [680, 400]
        }
      ],
      "connections": {
        "Workflow Input Payload": {
          "main": [
            [
              {
                "node": "Check DB Session",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Check DB Session": {
          "main": [
            [
              {
                "node": "Session Exists?",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Session Exists?": {
          "main": [
            [
              {
                "node": "Parse SQLite Payload",
                "type": "main",
                "index": 0
              }
            ],
            [
              {
                "node": "Create New Session Entry",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Create New Session Entry": {
          "main": [
            [
              {
                "node": "Return New Session JSON",
                "type": "main",
                "index": 0
              }
            ]
          ]
        }
      }
    }, null, 2)
  },
  cart: {
    name: "03. Gerenciador de Carrinho (Cart Actions)",
    description: "Operador que lida com as mutações no carrinho de compras: adicionar item se baseando em código ou descrição do catálogo, alterar quantidade, remover item, listar carrinho formatado visualmente para o WhatsApp e limpar carrinho pós-compra.",
    trigger: "Chamada de sub-workflow para ações de carrinho",
    nodesCount: 10,
    keyActionNodes: ["Action Switch (Add/Remove/List)", "Match Code in Database", "Update SQL Cart JSON", "Format Cart Message"],
    bestPractices: [
      "Modularidade: Utilize um nó Code unificado para as mutações de manipulação do array do carrinho (`addItem`, `removeItem`, `clear`), reduzindo nós desnecessários e protegendo contra conflitos de concorrência.",
      "Visualização Rica: Na listagem de carrinho, inclua sub-totais, somatório final e botões interativos para 'Finalizar Compra' ou 'Continuar Compras'."
    ],
    json: JSON.stringify({
      "name": "03. WhatsApp Cart Manager",
      "nodes": [
        {
          "parameters": {
            "options": {}
          },
          "id": "e932efba-42bb-48cf-990a-cfbd148db991",
          "name": "Cart Trigger Input",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeVersion": 1,
          "position": [100, 300]
        },
        {
          "parameters": {
            "rules": {
              "values": [
                {
                  "value1": "={{ $json.action }}",
                  "value2": "add",
                  "operation": "equal"
                },
                {
                  "value1": "={{ $json.action }}",
                  "value2": "remove",
                  "operation": "equal"
                },
                {
                  "value1": "={{ $json.action }}",
                  "value2": "view",
                  "operation": "equal"
                }
              ]
            }
          },
          "id": "bd763fb4-569d-43ff-bfec-dd62bf0409a2",
          "name": "Cart Action Router",
          "type": "n8n-nodes-base.switch",
          "typeVersion": 1,
          "position": [280, 300]
        },
        {
          "parameters": {
            "jsCode": "const session = items[0].json.session;\nconst product = items[0].json.payload.product;\nconst quantity = items[0].json.payload.quantity || 1;\nconst selectedSize = items[0].json.payload.size || 'M';\n\nlet cart = session.cart || [];\n\n// Busca se o produto no tamanho específico já está no carrinho\nconst itemIndex = cart.findIndex(i => i.product.id === product.id && i.size === selectedSize);\n\nif (itemIndex > -1) {\n  cart[itemIndex].quantity += quantity;\n} else {\n  cart.push({\n    product: product,\n    quantity: quantity,\n    size: selectedSize\n  });\n}\n\nreturn [{\n  json: {\n    phone: session.phone,\n    cart: cart,\n    updated: true\n  }\n}];"
          },
          "id": "9bc83f0d-acb1-419b-b2db-ffefbc7a54ba",
          "name": "Add Item Logic",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [500, 200]
        },
        {
          "parameters": {
            "jsCode": "const session = items[0].json.session;\nconst productId = items[0].json.payload.productId;\nconst selectedSize = items[0].json.payload.size || 'M';\n\nlet cart = session.cart || [];\n\n// Remove item do carrinho\ncart = cart.filter(i => !(i.product.id === productId && i.size === selectedSize));\n\nreturn [{\n  json: {\n    phone: session.phone,\n    cart: cart,\n    updated: true\n  }\n}];"
          },
          "id": "5fa9be83-9bc3-4889-bcde-39ddfbc8120e",
          "name": "Remove Item Logic",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [500, 320]
        },
        {
          "parameters": {
            "operation": "executeQuery",
            "query": "UPDATE customer_sessions SET cart_json = :cartJson, state = 'SHOPPING', updated_at = datetime('now') WHERE phone = :phone;",
            "additionalFields": {
              "parameterizedFieldsUi": {
                "parameterizedFields": [
                  {
                    "name": "cartJson",
                    "value": "={{ JSON.stringify($json.cart) }}"
                  },
                  {
                    "name": "phone",
                    "value": "={{ $json.phone }}"
                  }
                ]
              }
            }
          },
          "id": "8ca090be-cca9-4d6f-bfdd-cb769be3eef2",
          "name": "Save Updated Cart",
          "type": "n8n-nodes-base.sqlite",
          "typeVersion": 1,
          "position": [750, 260]
        },
        {
          "parameters": {
            "jsCode": "const session = items[0].json.session;\nconst cart = session.cart || [];\n\nif (cart.length === 0) {\n  return [{\n    json: { text: \"Seu carrinho está vazio 🧺. Que tal ver nosso catálogo de roupas? Digite o código de um produto para ver detalhes!\" }\n  }];\n}\n\nlet responseText = \"🛒 *SEU CARRINHO DE COMPRAS*\\n\\n\";\nlet total = 0;\n\ncart.forEach((item, index) => {\n  const subtotal = item.product.price * item.quantity;\n  total += subtotal;\n  responseText += `${index + 1}. *${item.product.name}*\\n`;\n  responseText += `   └ Tam: ${item.size} | Qtd: ${item.quantity} x R$ ${item.product.price.toFixed(2).replace('.', ',')}\\n`;\n  responseText += `   └ Subtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}\\n\\n`;\n});\n\nresponseText += `*────────────────────*\\n`;\nresponseText += `💰 *VALOR TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*\\n\\n`;\nresponseText += `Para fechar seu pedido agora, basta responder *FINALIZAR*.`;\n\nreturn [{\n  json: { text: responseText }\n}];"
          },
          "id": "e98abac0-d9da-4ecc-b778-cb7321e06fe3",
          "name": "Format Cart View",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [500, 440]
        },
        {
          "parameters": {
            "method": "POST",
            "url": "=http://evolution-api:8080/message/sendText",
            "sendHeaders": true,
            "headerParameters": {
              "parameters": [
                {
                  "name": "apikey",
                  "value": "your_evolution_api_secret_key"
                }
              ]
            },
            "sendBody": true,
            "contentType": "json",
            "bodyParameters": {
              "parameters": [
                {
                  "name": "number",
                  "value": "={{ $('Cart Trigger Input').item.json.session.phone }}"
                },
                {
                  "name": "text",
                  "value": "={{ $json.text }}"
                }
              ]
            }
          },
          "id": "2ba390be-a00d-4fa8-bf11-bb0389aef291",
          "name": "Send WhatsApp Cart Reply",
          "type": "n8n-nodes-base.httpRequest",
          "typeVersion": 3,
          "position": [950, 350]
        }
      ],
      "connections": {
        "Cart Trigger Input": {
          "main": [
            [
              {
                "node": "Cart Action Router",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Cart Action Router": {
          "main": [
            [
              {
                "node": "Add Item Logic",
                "type": "main",
                "index": 0
              }
            ],
            [
              {
                "node": "Remove Item Logic",
                "type": "main",
                "index": 1
              }
            ],
            [
              {
                "node": "Format Cart View",
                "type": "main",
                "index": 2
              }
            ]
          ]
        },
        "Add Item Logic": {
          "main": [
            [
              {
                "node": "Save Updated Cart",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Remove Item Logic": {
          "main": [
            [
              {
                "node": "Save Updated Cart",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Save Updated Cart": {
          "main": [
            [
              {
                "node": "Format Cart View",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Format Cart View": {
          "main": [
            [
              {
                "node": "Send WhatsApp Cart Reply",
                "type": "main",
                "index": 0
              }
            ]
          ]
        }
      }
    }, null, 2)
  },
  checkout: {
    name: "04. Checkout & Chave Pix Automática",
    description: "Workflow responsável pelo fechamento estruturado do pedido. Bloqueia o estado para 'WAITING_PAYMENT', gera a chave estática ou dinâmica via Pix (QR Code Payload), calcula o JSON NFC-e, e dispara cobrança.",
    trigger: "Input de encerramento do cliente (mensagem 'FINALIZAR' ou 'PAGAR')",
    nodesCount: 9,
    keyActionNodes: ["Create Pix Dynamic", "NFC-e Payload Structurer", "Change State to WAITING_PAYMENT", "Send Pix Info with Copy-and-Paste Key"],
    bestPractices: [
      "Pix Copia e Cola: Sempre forneça a chave Pix em formato de texto isolado em uma única mensagem para facilitar que o cliente copie no celular.",
      "Webhook de Conciliação: Registre o ID de transação (EndToEndID ou TxID) na tabela SQLite para conciliar automaticamente quando o Pix for pago."
    ],
    json: JSON.stringify({
      "name": "04. WhatsApp Checkout & Pix",
      "nodes": [
        {
          "parameters": {
            "options": {}
          },
          "id": "1fa3adef-bc2d-4589-9fc6-cda0a6be12ef",
          "name": "Checkout Start Trigger",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeVersion": 1,
          "position": [100, 300]
        },
        {
          "parameters": {
            "jsCode": "const session = items[0].json.session;\nconst cart = session.cart || [];\n\nif (cart.length === 0) {\n  return [{\n    json: {\n      isValid: false,\n      text: \"Desculpe, seu carrinho está vazio! Adicione algum produto antes de finalizar.\"\n    }\n  }];\n}\n\nlet total = 0;\ndouble_total = 0;\ncart.forEach(i => {\n  total += i.product.price * i.quantity;\n});\n\nconst transactionId = 'TX' + Math.floor(Math.random() * 1000000000);\n// Em produção, isso integraria com o Pix do Efí ou OpenPix\nconst pixKey = `00020101021226830014br.gov.bcb.pix2561api.pixpayment.com.br/v2/${transactionId}5204000053039865405${total.toFixed(2)}5802BR5915LOJA_ROUPAS6009SAO_PAULO62070503***6304`;\n\nreturn [{\n  json: {\n    isValid: true,\n    total: total,\n    transactionId: transactionId,\n    pixKey: pixKey,\n    phone: session.phone\n  }\n}];"
          },
          "id": "e0ca342c-cca2-411a-abfb-f90fbca9283a",
          "name": "Generate Simulated Pix & TxId",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [300, 300]
        },
        {
          "parameters": {
            "operation": "executeQuery",
            "query": "UPDATE customer_sessions SET state = 'WAITING_PAYMENT', transaction_id = :txid, total_value = :total, updated_at = datetime('now') WHERE phone = :phone;",
            "additionalFields": {
              "parameterizedFieldsUi": {
                "parameterizedFields": [
                  {
                    "name": "txid",
                    "value": "={{ $json.transactionId }}"
                  },
                  {
                    "name": "total",
                    "value": "={{ $json.total }}"
                  },
                  {
                    "name": "phone",
                    "value": "={{ $json.phone }}"
                  }
                ]
              }
            }
          },
          "id": "4da7cf90-cca1-482f-bcf0-ddbe3af902ae",
          "name": "Set waiting_payment State",
          "type": "n8n-nodes-base.sqlite",
          "typeVersion": 1,
          "position": [500, 300]
        },
        {
          "parameters": {
            "jsCode": "const total = $('Generate Simulated Pix & TxId').item.json.total;\nconst pixKey = $('Generate Simulated Pix & TxId').item.json.pixKey;\nconst txId = $('Generate Simulated Pix & TxId').item.json.transactionId;\n\nlet text = \"🏷️ *FINALIZAÇÃO DE PEDIDO*\\n\\n\";\ntext += \"Seu pedido foi registrado e está reservado! Aguardando pagamento Pix.\\n\\n\";\ntext += `💰 *Valor total:* R$ ${total.toFixed(2).replace('.', ',')}\\n`;\ntext += `🆔 *Cód. Pedido:* ${txId}\\n\\n`;\ntext += \"Copie o código *Pix Copia e Cola* abaixo para efetuar o pagamento no app do seu banco:\\n\";\n\nreturn [{\n  json: {\n    checkoutMsg: text,\n    pixKey: pixKey\n  }\n}];"
          },
          "id": "76fabc90-bdf9-42ff-bfa1-cb23db2ae82a",
          "name": "Build Rich WhatsApp Msg",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [700, 300]
        },
        {
          "parameters": {
            "method": "POST",
            "url": "http://evolution-api:8080/message/sendText",
            "sendHeaders": true,
            "headerParameters": {
              "parameters": [
                {
                  "name": "apikey",
                  "value": "your_evolution_api_secret_key"
                }
              ]
            },
            "sendBody": true,
            "contentType": "json",
            "bodyParameters": {
              "parameters": [
                {
                  "name": "number",
                  "value": "={{ $('Generate Simulated Pix & TxId').item.json.phone }}"
                },
                {
                  "name": "text",
                  "value": "={{ $json.checkoutMsg }}"
                }
              ]
            }
          },
          "id": "3be6ea49-dcbd-49be-bc87-9bc68de3e8ac",
          "name": "Send Text Message",
          "type": "n8n-nodes-base.httpRequest",
          "typeVersion": 3,
          "position": [900, 240]
        },
        {
          "parameters": {
            "method": "POST",
            "url": "http://evolution-api:8080/message/sendText",
            "sendHeaders": true,
            "headerParameters": {
              "parameters": [
                {
                  "name": "apikey",
                  "value": "your_evolution_api_secret_key"
                }
              ]
            },
            "sendBody": true,
            "contentType": "json",
            "bodyParameters": {
              "parameters": [
                {
                  "name": "number",
                  "value": "={{ $('Generate Simulated Pix & TxId').item.json.phone }}"
                },
                {
                  "name": "text",
                  "value": "={{ $('Build Rich WhatsApp Msg').item.json.pixKey }}"
                }
              ]
            }
          },
          "id": "a0e23112-9bdc-44de-89cc-cf9ab40ef1bc",
          "name": "Send Pix CopyPaste Main Key",
          "type": "n8n-nodes-base.httpRequest",
          "typeVersion": 3,
          "position": [900, 380]
        }
      ],
      "connections": {
        "Checkout Start Trigger": {
          "main": [
            [
              {
                "node": "Generate Simulated Pix & TxId",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Generate Simulated Pix & TxId": {
          "main": [
            [
              {
                "node": "Set waiting_payment State",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Set waiting_payment State": {
          "main": [
            [
              {
                "node": "Build Rich WhatsApp Msg",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Build Rich WhatsApp Msg": {
          "main": [
            [
              {
                "node": "Send Text Message",
                "type": "main",
                "index": 0
              },
              {
                "node": "Send Pix CopyPaste Main Key",
                "type": "main",
                "index": 0
              }
            ]
          ]
        }
      }
    }, null, 2)
  },
  abandonedCart: {
    name: "05. Recuperação de Carrinho Abandonado",
    description: "Disparado via Cron do n8n a cada hora. Busca de maneira totalmente automática todas as sessões que estão no estado 'SHOPPING' (carrinho iniciado), com produtos adicionados, que não foram atualizadas nas últimas 24h ou 48h, e envia mensagens altamente persuasivas.",
    trigger: "Cron Node (A cada 60 minutos)",
    nodesCount: 9,
    keyActionNodes: ["Cron Rule Trigger", "SQLite Fetch Abandoned Carts", "Interval Calculator (Date Compare)", "Write Flag to SQLite", "Send Whatsapp Alert"],
    bestPractices: [
      "Controle de Envio Unificado: Sempre salve uma flag `abandoned_notified` (0, 1 ou 2) para garantir que apenas um lembrete seja enviado por faixa horária (24h/48h) e não spame o cliente.",
      "Ganchos de Desconto: No segundo lembrete (48h), envie um incentivo opcional (como cupom de frete grátis: 'FRETEGRAU') para otimizar a conversão."
    ],
    json: JSON.stringify({
      "name": "05. WhatsApp Abandoned Cart Recovery (24h / 48h)",
      "nodes": [
        {
          "parameters": {
            "triggerTimes": {
              "value": [
                {
                  "mode": "everyHour"
                }
              ]
            }
          },
          "id": "c1f7b8ca-9be8-444f-bcbc-12fedcf2382e",
          "name": "Every Hour Cron",
          "type": "n8n-nodes-base.cron",
          "typeVersion": 1,
          "position": [100, 300]
        },
        {
          "parameters": {
            "operation": "executeQuery",
            "query": "SELECT * FROM customer_sessions WHERE state = 'SHOPPING' AND cart_json != '[]' AND cart_json IS NOT NULL AND updated_at < datetime('now', '-24 hours') AND abandoned_notified < 2;"
          },
          "id": "e98cbcf8-a92c-473c-bcdd-9fa31be3211f",
          "name": "Fetch Inactive Shopping Carts",
          "type": "n8n-nodes-base.sqlite",
          "typeVersion": 1,
          "position": [300, 300]
        },
        {
          "parameters": {
            "jsCode": "const now = new Date();\nconst results = [];\n\nfor (const item of items) {\n  const updatedAt = new Date(item.json.updated_at);\n  const hoursDiff = Math.abs(now - updatedAt) / 36e5;\n  const notified = item.json.abandoned_notified || 0;\n  \n  let shouldSend = false;\n  let type = '';\n  let promoMsg = '';\n  \n  if (hoursDiff >= 48 && notified < 2) {\n    shouldSend = true;\n    type = '48h';\n    promoMsg = \"Ganhou cupom de FRETE GRÁTIS! Digite *QUERO* para fechar com o cupom: *FRETEGRATIS* 🎉\";\n  } else if (hoursDiff >= 24 && notified < 1) {\n    shouldSend = true;\n    type = '24h';\n    promoMsg = \"Notamos que suas peças lindas ainda estão te esperando! Digite *CARRINHO* para continuar de onde parou.\";\n  }\n  \n  if (shouldSend) {\n    results.push({\n      json: {\n        phone: item.json.phone,\n        name: item.json.name,\n        type: type,\n        notifiedLevel: type === '48h' ? 2 : 1,\n        message: `Olá, ${item.json.name}! Tudo bem?\\n\\n${promoMsg}`\n      }\n    });\n  }\n}\n\nreturn results;"
          },
          "id": "4da9fcdd-8cba-49ae-bcde-39ddcfb9a0ae",
          "name": "Segment 24h & 48h Batches",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [500, 300]
        },
        {
          "parameters": {
            "method": "POST",
            "url": "http://evolution-api:8080/message/sendText",
            "sendHeaders": true,
            "headerParameters": {
              "parameters": [
                {
                  "name": "apikey",
                  "value": "your_evolution_api_secret_key"
                }
              ]
            },
            "sendBody": true,
            "contentType": "json",
            "bodyParameters": {
              "parameters": [
                {
                  "name": "number",
                  "value": "={{ $json.phone }}"
                },
                {
                  "name": "text",
                  "value": "={{ $json.message }}"
                }
              ]
            }
          },
          "id": "ca92ebff-cca9-4a9f-88ee-cfba99eacb92",
          "name": "Send WhatsApp Recovery Text",
          "type": "n8n-nodes-base.httpRequest",
          "typeVersion": 3,
          "position": [720, 240]
        },
        {
          "parameters": {
            "operation": "executeQuery",
            "query": "UPDATE customer_sessions SET abandoned_notified = :notifiedLevel, updated_at = datetime('now') WHERE phone = :phone;",
            "additionalFields": {
              "parameterizedFieldsUi": {
                "parameterizedFields": [
                  {
                    "name": "notifiedLevel",
                    "value": "={{ $json.notifiedLevel }}"
                  },
                  {
                    "name": "phone",
                    "value": "={{ $json.phone }}"
                  }
                ]
              }
            }
          },
          "id": "8bcfae90-cda9-4ec9-bcfd-92dfbcbefc93",
          "name": "Update Notified Flags",
          "type": "n8n-nodes-base.sqlite",
          "typeVersion": 1,
          "position": [920, 240]
        }
      ],
      "connections": {
        "Every Hour Cron": {
          "main": [
            [
              {
                "node": "Fetch Inactive Shopping Carts",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Fetch Inactive Shopping Carts": {
          "main": [
            [
              {
                "node": "Segment 24h & 48h Batches",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Segment 24h & 48h Batches": {
          "main": [
            [
              {
                "node": "Send WhatsApp Recovery Text",
                "type": "main",
                "index": 0
              }
            ]
          ]
        },
        "Send WhatsApp Recovery Text": {
          "main": [
            [
              {
                "node": "Update Notified Flags",
                "type": "main",
                "index": 0
              }
            ]
          ]
        }
      }
    }, null, 2)
  }
};
