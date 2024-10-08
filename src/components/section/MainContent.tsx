import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';


import { ChatViewArea } from "../ChatViewArea.tsx";
import { ChatInputArea } from "../ChatInputArea.tsx";
import { Hotel, HotelElement } from "../element/HotelElement.tsx";

import { convertNonNullableValue, isJsonParsable, Nullable } from "../../common.ts";
import { v4 as uuid } from "uuid";
import { generateClient } from "aws-amplify/api";
import type { Schema } from "../../../amplify/data/resource.ts";
import { Message } from "../ChatMessage.tsx";


const client = generateClient<Schema>();

interface AgentRequest {
    sessionId: string,
    inputText: string,
    // selectedHotel: SelectedHotel | null
}

interface AgentResponse {
    hotels: Hotel[]
}


const boxStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
}

export function MainContent(): React.JSX.Element {
    useEffect(() => {
        sessionStorage.setItem('sessionId', uuid())
    }, [])

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);

    /**
     * ユーザーの入力値を画面に反映
     * @param text
     */
    const renderUserMessage = (text: string) => {
        const userMessage: Message = {
            id: uuid(),
            sender: 'user',
            element: <>{text}</>,
        };
        setInput('');
        setMessages((prev) => [...prev, userMessage]);
    }

    /**
     * エージェント実行
     * @param text
     */
    const executeAgent = async (text: string) => {
        try {
            const sessionId = sessionStorage.getItem('sessionId')
            if (!sessionId) {
                console.log('The session ID is invalid.')
                return;
            } else {
                const request: AgentRequest = {
                    sessionId: sessionId,
                    inputText: text,
                }
                const response = await client.queries.recommendationsHotels(request);

                return response.data
            }
        } catch (error) {
            console.error('Failed to fetch text:', error);
        }
    }

    /**
     * 回答結果を整形して画面に反映
     * @param response
     */
    const renderAIMessage = (response: Nullable<string> | undefined) => {

        const render = (aiMessage: Message) => {
            setMessages((prev) => [...prev, aiMessage]);
        }

        const convertedResponse: string = convertNonNullableValue(response)

        let element: React.JSX.Element = <></>;

        if (isJsonParsable(convertedResponse)) {
            const parsedResponse: AgentResponse = JSON.parse(convertedResponse)

            if ('hotels' in parsedResponse) {
                const changeSelectedHotel = (selectedHotel: Hotel) => {
                    console.log(selectedHotel)
                }

                const registerHotel = async (selectedHotel: Hotel) => {
                    const sessionId = sessionStorage.getItem('sessionId')
                    if (!sessionId) {
                        console.log('The session ID is invalid.')
                        return;
                    }

                    await client.models.Plan.create({
                        PK: sessionId,
                        SK: 'Metadata',
                        Hotel: {
                            name: selectedHotel.name,
                            description: selectedHotel.description
                        },
                    })

                    // 次のエージェントをよぶ


                    const aiMessage: Message = {
                        id: uuid(),
                        sender: 'ai',
                        element: <>{selectedHotel.name}が選ばれました。</>,
                    };
                    render(aiMessage)
                }

                element = <HotelElement
                    hotels={parsedResponse.hotels}
                    changeSelectedHotel={changeSelectedHotel}
                    registerHotel={registerHotel}

                >
                </HotelElement>
            }
        } else {
            element = <>{convertedResponse}</>
        }

        const aiMessage: Message = {
            id: uuid(),
            sender: 'ai',
            element: element,
        };
        render(aiMessage)
    }

    /**
     * ユーザーの入力をエージェントに送信する
     */
    const sendMessage = async () => {
        if (!input.trim() || isSending) return;
        setIsSending(true);
        renderUserMessage(input);

        try {
            const response: Nullable<string> | undefined = await executeAgent(input)
            renderAIMessage(response)
        } finally {
            setIsSending(false);
        }
    }

    return (
        <Box component="main" sx={boxStyle}>
            <ChatViewArea messages={messages}/>
            <ChatInputArea input={input} setInput={setInput} sendMessage={sendMessage} isDisabled={false}/>
        </Box>
    );
}
