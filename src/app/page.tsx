import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Metas</CardTitle>
        </CardHeader>
        <CardContent>
          <Button>Começar</Button>
        </CardContent>
      </Card>
    </main>
  )
}
