const exec = async (botId) => {
  // If the user types something with the intent of exiting the conversation with bot 2
  // We dont execute the function and just return, this intent can be changed
  if (event.nlu.intent.name == "exit") {
    return;
  }

  if (!session.delegation) {
    session.delegation = {};
  }

  let delegation = session.delegation[botId];

  // Create a session with the target bot, if we don’t have it yet
  if (!delegation || !delegation.uniqueUserId || !delegation.axiosConfig) {
    session.delegation[botId] = {};
    const random = Math.random().toString().substr(3, 8);

    session.delegation[botId].uniqueUserId = `delegate_${event.target}_${random}`;
    session.delegation[botId].axiosConfig = await bp.http.getAxiosConfigForBot(botId, { localUrl: true });
    delegation = session.delegation[botId];
  }

  // Sends the user input to the target bot
  const res = await axios
    .post(
      `/converse/${delegation.uniqueUserId}/secured`,
      {
        type: "text",
        text: event.preview,
        includedContexts: ["global"],
      },
      { ...delegation.axiosConfig }
    )
    .catch(() => ({ data: {} /* We don't want the error to crash the master bot */ }));

  // Process
  const responses = [];
  for (let response of res.data.responses) {
    if (response.type != "custom" || event.channel != "telegram") {
      responses.push(response);
    } else if (response.component == "QuickReplies") {
      // This will fix the issue caused by an outgoing hook from channel-web
      responses.push({
        ...response.wrapped,
        quick_replies: response.quick_replies,
      });
    }
  }

  // Sends to the user what the target bot responded
  bp.events.replyToEvent(
    {
      botId: event.botId,
      channel: event.channel,
      target: event.target,
      threadId: event.threadId,
    },
    responses,
    event.id
  );
};

return exec(args.botId);