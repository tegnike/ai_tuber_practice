export const AssistantText = ({ message }: { message: string }) => {
  return (
    <div className="absolute bottom-0 left-0 w-full" style={{ marginBottom: '160px' }}>
      <div className="mx-auto max-w-3xl w-full p-16">
        <div className="bg-white rounded-8">
          <div className="px-24 py-16">
            <div className="line-clamp-4 text-primary typography-16 font-M_PLUS_2 font-bold">
              {message.replace(/\[([a-zA-Z]*?)\]/g, "")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
